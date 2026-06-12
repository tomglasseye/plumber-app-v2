# Notifications

There are two layers. **In-app** notifications (Supabase Realtime → bell + on-screen banner) are the primary, always-on layer and are fully working. **Web Push** (native OS notifications) is opt-in per business and **default off** — and its send path is not yet wired up (see "Push status" below).

---

## Two types of notification

| Type       | What it is                                       | When it fires                        | Status |
| ---------- | ------------------------------------------------ | ------------------------------------ | ------ |
| **In-app** | Notification bell counter + dropdown list        | While the app is open in the browser | ✅ Live, always on |
| **Push**   | Native OS notification (even when app is closed) | On status/priority changes (planned) | ⚠️ Opt-in (default off); **send path not yet wired** |

---

## Push status (read before working on push)

The push **infrastructure** exists end to end — VAPID keys, `public/sw-push.js`, the `push_subscriptions` table, `subscribeToPush()`, the `send-push` Netlify Function. **But `firePush()` is never called anywhere in the app**, so no native push has ever actually been sent. The only runtime effect of the push code is the OS permission prompt that `subscribeToPush()` raises.

Because clients in testing prefer the quieter in-app bell over OS-level interruptions, Web Push is now **opt-in per business** and **default off**:

- `businesses.push_enabled` (boolean, default `false`) — migration 29.
- A business master toggles it in **Account → Business → Notifications**.
- `AppContext.loadUserData()` only calls `subscribeToPush()` when `push_enabled` is true, so a team is never prompted for OS notification permission unless their master opted in. Super admins are never prompted (no business context on the admin dashboard).
- **In-app notifications are unaffected** by this flag — the bell and banner always run.

**Later phase — actually sending push.** When push is wanted, wire `firePush()` into the status/priority change paths in `AppContext` (and/or a DB trigger calling `send-push`), and have those call sites respect `business.push_enabled` too. Until then the toggle only gates the subscription/permission prompt.

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
    self.registration.showNotification(data.title ?? "HiveQ", {
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

Fetches all subscriptions for the target `userId`, sends the push payload via the `web-push` library, and removes expired/gone endpoints (404/410) automatically.

**Security contract (hardened June 2026):** the sender must be a **master**; the target must be in the sender's business; the optional deep-link `url` must be a **relative path** (`/job/123`) — absolute/external URLs are rejected with 400, and `sw-push.js` independently refuses to open non-relative URLs as defence in depth; title/body are length-capped (120/500). Rationale: without the master check, any engineer could push arbitrary HQ-looking messages or links to colleagues. When engineer→master push events are wanted (status changes, holiday requests), send them **server-side** (e.g. a function/trigger using the service role) rather than loosening the sender check.

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
- [x] `firePush()` utility defined — fires and forgets
- [x] `send-push` Netlify Function wired up (master-only sender, relative-URL deep links, length caps)
- [x] Per-business opt-in `push_enabled` (default off), toggle on Account page (migration 29)
- [x] Subscribe called after login **only when `push_enabled`**
- [x] iOS "Add to Home Screen" banner (`IosInstallPrompt.tsx`)
- [ ] **Later phase:** call `firePush()` on status/priority change events (currently never called → no push is actually sent). Note: `send-push` now requires a **master** sender — engineer-originated events (status updates, holiday requests) must be pushed server-side rather than from the engineer's session.
