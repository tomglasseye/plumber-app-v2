# Notifications

The app currently has a **simulated notification system** in-memory (the `pushBanner` state in `AppContext.tsx`). This document covers replacing it with real-time in-app notifications via Supabase Realtime and actual browser push notifications via the Web Push API.

---

## Two types of notification

| Type       | What it is                                       | When it fires                        |
| ---------- | ------------------------------------------------ | ------------------------------------ |
| **In-app** | Notification bell counter + dropdown list        | While the app is open in the browser |
| **Push**   | Native OS notification (even when app is closed) | Configurable — see below             |

Both can coexist. Start with in-app (simpler), then layer push on top.

---

## Part 1 — In-app notifications (Supabase Realtime)

### How it works

Every time a job status changes, a row is inserted into the `notifications` table. Supabase Realtime streams those inserts over a WebSocket. The app listens for new rows addressed to the current user and updates the bell counter.

### Supabase Realtime subscription

Replace the prototype's simulated notifications in `AppContext.tsx`:

```ts
import { supabase } from "./supabase"; // your supabase client

// Inside AppProvider, after supabase auth is set up:
useEffect(() => {
	if (!currentUser) return;

	const channel = supabase
		.channel("app-notifications")
		.on(
			"postgres_changes",
			{
				event: "INSERT",
				schema: "public",
				table: "notifications",
				// Only receive notifications addressed to this user or to 'master' if they are master
				filter:
					currentUser.role === "master"
						? `for=eq.master`
						: `for=eq.${currentUser.id}`,
			},
			(payload) => {
				const newNotif = payload.new as Notification;
				setNotifications((prev) => [newNotif, ...prev]);
				setPushBanner(newNotif.message);
				setTimeout(() => setPushBanner(null), 4000);
			},
		)
		.subscribe();

	return () => {
		supabase.removeChannel(channel);
	};
}, [currentUser]);
```

### Realtime filter note

Supabase Realtime row-level filters are in beta. If the filter syntax above doesn't work as expected, fall back to filtering client-side:

```ts
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
  const notif = payload.new as Notification;
  const isForMe = notif.for === currentUser?.id || notif.for === currentUser?.role;
  if (isForMe) { ... }
})
```

### Checking unread notifications on load

When the user logs in, fetch unread notifications from the database:

```ts
const { data } = await supabase
	.from("notifications")
	.select("*")
	.or(`for.eq.${currentUser.id},for.eq.${currentUser.role}`)
	.eq("read", false)
	.order("created_at", { ascending: false })
	.limit(20);

setNotifications(data ?? []);
```

### Marking notifications as read

```ts
async function clearNotifs() {
	setNotifications([]);
	await supabase
		.from("notifications")
		.update({ read: true })
		.or(`for.eq.${currentUser!.id},for.eq.${currentUser!.role}`);
}
```

---

## Part 2 — Push notifications (Web Push API)

### Why a server is required

Push notifications use VAPID keys. The **private VAPID key must never be in the browser**. A Netlify Function acts as the push sender — it holds the private key and calls the push service on behalf of the app.

### 1. Generate VAPID keys (once, on your machine)

```bash
npx web-push generate-vapid-keys
```

Output:

```
Public Key:  BExS...
Private Key: 7Kx3...
```

Add to Netlify environment variables:

```
VAPID_PUBLIC_KEY=BExS...
VAPID_PRIVATE_KEY=7Kx3...
VAPID_MAILTO=mailto:you@example.com
```

Add the public key to `.env.local` (safe for the browser):

```
VITE_VAPID_PUBLIC_KEY=BExS...
```

### 2. Service worker — handle push events

In `public/sw.js` (or the `vite-plugin-pwa` service worker — see [PWA.md](./PWA.md)):

```js
self.addEventListener("push", (event) => {
	const data = event.data?.json() ?? {};
	event.waitUntil(
		self.registration.showNotification(data.title ?? "Plumber App", {
			body: data.body ?? "",
			icon: "/icons/icon-192x192.png",
			badge: "/icons/icon-192x192.png",
			tag: data.tag ?? "general",
			data: { url: data.url ?? "/" },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	event.waitUntil(
		clients.matchAll({ type: "window" }).then((clientList) => {
			const url = event.notification.data?.url ?? "/";
			for (const client of clientList) {
				if (client.url === url && "focus" in client)
					return client.focus();
			}
			if (clients.openWindow) return clients.openWindow(url);
		}),
	);
});
```

### 3. Subscribe the user in the app

After the user logs in and grants permission, subscribe them to push and save the subscription to Supabase.

```ts
// src/utils/push.ts

export function urlBase64ToUint8Array(base64String: string) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding)
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const rawData = atob(base64);
	return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush(userId: string) {
	if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

	const permission = await Notification.requestPermission();
	if (permission !== "granted") return;

	const registration = await navigator.serviceWorker.ready;

	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(
			import.meta.env.VITE_VAPID_PUBLIC_KEY,
		),
	});

	// Save to Supabase so the server can target this device
	await supabase.from("push_subscriptions").upsert({
		user_id: userId,
		endpoint: subscription.endpoint,
		p256dh: btoa(
			String.fromCharCode(
				...new Uint8Array(subscription.getKey("p256dh")!),
			),
		),
		auth: btoa(
			String.fromCharCode(
				...new Uint8Array(subscription.getKey("auth")!),
			),
		),
	});
}
```

Call `subscribeToPush(user.id)` after a successful login.

### 4. Push subscriptions table (Supabase)

```sql
create table push_subscriptions (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users not null,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

alter table push_subscriptions enable row level security;

create policy "Users manage own subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id);
```

### 5. Netlify Function — send push notification

Create `netlify/functions/send-push.ts`:

```ts
import type { Handler } from "@netlify/functions";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
	process.env.SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

webpush.setVapidDetails(
	process.env.VAPID_MAILTO!,
	process.env.VAPID_PUBLIC_KEY!,
	process.env.VAPID_PRIVATE_KEY!,
);

export const handler: Handler = async (event) => {
	const { userId, title, body, url } = JSON.parse(event.body ?? "{}");

	const { data: subs } = await supabase
		.from("push_subscriptions")
		.select("*")
		.eq("user_id", userId);

	const sends = (subs ?? []).map((sub) =>
		webpush
			.sendNotification(
				{
					endpoint: sub.endpoint,
					keys: { p256dh: sub.p256dh, auth: sub.auth },
				},
				JSON.stringify({ title, body, url }),
			)
			.catch(() => {
				// If subscription is gone, remove it
				supabase
					.from("push_subscriptions")
					.delete()
					.eq("endpoint", sub.endpoint);
			}),
	);

	await Promise.allSettled(sends);

	return {
		statusCode: 200,
		body: JSON.stringify({ sent: subs?.length ?? 0 }),
	};
};
```

Install `web-push`:

```bash
npm install web-push
npm install -D @types/web-push
```

### 6. Trigger push from status change

In `AppContext.tsx`, when `changeStatus` or `changePriority` is called, fire the push function after inserting the notification row:

```ts
async function changeStatus(jobId: string, status: Status) {
	const job = jobs.find((j) => j.id === jobId)!;

	// Update job in Supabase
	await supabase.from("jobs").update({ status }).eq("id", jobId);

	// Insert notification row
	const notifRecord = {
		business_id: business.id,
		job_id: jobId,
		message: `Job ${job.ref} status changed to ${status}`,
		for: "master",
		read: false,
	};
	await supabase.from("notifications").insert(notifRecord);

	// Fire push to HQ master user
	await fetch("/.netlify/functions/send-push", {
		method: "POST",
		body: JSON.stringify({
			userId: business.master_user_id,
			title: "Job Update",
			body: `${job.ref} — ${status}`,
			url: `/job/${jobId}`,
		}),
	});
}
```

---

## iOS requirements

iOS requires the app to be **added to the home screen** before push notifications work (iOS 16.4+).

- Show an "Add to Home Screen" nudge after login if on iOS Safari and not running in standalone mode:

```ts
const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
const isInStandaloneMode = window.matchMedia(
	"(display-mode: standalone)",
).matches;

if (isIos && !isInStandaloneMode) {
	// Show banner: "Add this app to your Home Screen to receive push notifications"
}
```

---

## Permission UX

Asking for notification permission too early is one of the top reasons users deny it. Best practice:

1. **Don't ask on first load** — let the user experience the app first
2. **Ask in context** — show a card in the Account Settings page: "Enable push notifications to get instant job updates"
3. **Explain the value** — "Engineers get notified when a job is assigned. HQ gets notified when status changes."

---

## Checklist

**In-app (Supabase Realtime)**

- [ ] Enable Realtime on the `notifications` table in Supabase dashboard (Table → Realtime → Enable)
- [ ] Replace simulated notifications in `AppContext.tsx` with Supabase channel subscription
- [ ] Fetch unread notifications on login
- [ ] Mark as read on bell dismiss

**Push (Web Push API)**

- [ ] Generate VAPID keys and add to Netlify env
- [ ] Add push handler to service worker (`sw.js`)
- [ ] Create `push_subscriptions` table in Supabase
- [ ] Build `subscribeToPush()` utility
- [ ] Call subscribe after login (with good permission UX)
- [ ] Build `send-push` Netlify Function
- [ ] Wire up push sends to status/priority change events
- [ ] Add iOS "Add to Home Screen" banner
