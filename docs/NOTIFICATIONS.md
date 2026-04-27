# Notifications

Both notification layers are fully implemented: in-app real-time via Supabase Realtime, and native Web Push for OS-level alerts when the app is closed.

---

## Two types of notification

| Type       | What it is                                       | When it fires                        |
| ---------- | ------------------------------------------------ | ------------------------------------ |
| **In-app** | Notification bell counter + dropdown list        | While the app is open in the browser |
| **Push**   | Native OS notification (even when app is closed) | On status/priority changes           |

---

## Part 1 — In-app notifications (Supabase Realtime)

Every time a job status changes, a row is inserted into the `notifications` table. Supabase Realtime streams those inserts over a WebSocket. The app listens for new rows addressed to the current user and updates the bell counter.

Jobs and team holidays also update in real time via Realtime subscriptions on those tables (migration 18). Both tables use `REPLICA IDENTITY FULL` so UPDATE payloads include the complete row.

### How it works in `AppContext.tsx`

- On login, unread notifications are fetched from Supabase (filtered by `for_user` or `for_role`)
- A Realtime channel subscribes to `INSERT` on the `notifications` table
- New rows trigger the bell counter and `PushBanner.tsx` for an on-screen drop-in banner (auto-dismisses after 4 s)
- Clicking the bell marks all as read via `UPDATE ... SET read = true`

---

## Part 2 — Web Push (native OS notifications)

### Architecture

```
Status/priority change in AppContext
  → INSERT into notifications table
  → POST /.netlify/functions/send-push
  → Netlify Function (holds VAPID private key)
  → Push service (Google, Apple, Mozilla)
  → Device receives notification even when app is closed
```

### Environment variables

| Variable            | Where          | Value                                |
| ------------------- | -------------- | ------------------------------------ |
| `VAPID_PUBLIC_KEY`  | Netlify        | From `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Netlify        | From same command (keep secret)      |
| `VAPID_MAILTO`      | Netlify        | `mailto:you@example.com`             |
| `VITE_VAPID_PUBLIC_KEY` | `.env.local` + Netlify | Same public key (browser-safe) |

> **Heads up:** Netlify currently has a `VAPID_EMAIL` variable set, but the code reads `VAPID_MAILTO` (with a fallback to `mailto:admin@example.com`). Rename the Netlify env var to `VAPID_MAILTO` so the correct contact address is sent to push services. See [LAUNCH.md](LAUNCH.md) Phase 3e.

Generate keys once:

```bash
npx web-push generate-vapid-keys
```

### Service worker — `public/sw-push.js`

Injected into the Workbox service worker via `vite.config.ts` → `workbox.importScripts`. Handles `push` and `notificationclick` events:

```js
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "PipeLine", {
      body: data.body ?? "",
      icon: "/icon.svg",
      tag: data.tag ?? "general",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      const url = event.notification.data?.url ?? "/";
      for (const client of list) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
```

### Subscribing users — `src/utils/push.ts`

`subscribeToPush(userId)` is called after login. It requests permission, creates a push subscription via `PushManager`, and saves the endpoint + keys to the `push_subscriptions` table in Supabase.

`firePush(userId, title, body, url?)` fires and forgets a POST to `/.netlify/functions/send-push`. Errors are silently swallowed so a push failure never breaks the main flow.

### Netlify Function — `netlify/functions/send-push.ts`

Fetches all subscriptions for the target `userId`, sends the push payload via the `web-push` library, and removes any expired/gone endpoints automatically.

### iOS requirements

iOS requires the app to be **added to the home screen** before push notifications work (iOS 16.4+). `src/components/IosInstallPrompt.tsx` shows a dismissable banner in Safari on iOS devices that are not already in standalone mode. The banner explains the share → "Add to Home Screen" flow and is suppressed permanently once dismissed (persisted to `localStorage`).

---

## Checklist

**In-app (Supabase Realtime)**

- [x] Enable Realtime on the `notifications` table in Supabase dashboard
- [x] Enable Realtime on `jobs` and `team_holidays` (migration 18, `REPLICA IDENTITY FULL`)
- [x] Supabase Realtime channel subscription in `AppContext.tsx`
- [x] Fetch unread notifications on login
- [x] Mark as read on bell dismiss
- [x] `PushBanner.tsx` for live on-screen alerts

**Push (Web Push API)**

- [x] Generate VAPID keys and add to Netlify env
- [x] Push handler in `public/sw-push.js` (injected via Workbox `importScripts`)
- [x] `push_subscriptions` table in Supabase (migration 20)
- [x] `subscribeToPush()` utility in `src/utils/push.ts`
- [x] `firePush()` utility — fires and forgets
- [x] Subscribe called after login
- [x] `send-push` Netlify Function wired up
- [x] Push fires on status/priority change events
- [x] iOS "Add to Home Screen" banner (`IosInstallPrompt.tsx`)
