# Progressive Web App — Offline Support

> **Status:** `vite-plugin-pwa` is installed and configured with a basic manifest and `registerType: 'autoUpdate'`. The app is technically a PWA but is missing proper app icons (using `vite.svg` placeholder), Workbox caching strategies, and an offline data queue. See the checklist at the bottom for remaining work.

This document covers converting the app into a full offline-capable PWA so engineers can use it on sites with poor signal.

---

## What problem this solves

Plumbers often work in places with no signal: underground plant rooms, rural properties, new builds. When an engineer opens the app in the morning over WiFi, everything they need for the day should be cached on their phone. If they lose signal on site, the app still works — they can view job details, update status, add notes. Changes sync back to Supabase automatically when signal returns.

Additionally, a PWA can be added to the home screen — full screen, no browser chrome, custom icon — making it feel like a native app on both Android and iOS.

---

## What a PWA consists of

1. **Web App Manifest** (`public/manifest.json`) — tells the browser the app name, icons, theme colour, and display mode (standalone = no browser bar)
2. **Service Worker** — a JavaScript file that runs in the background, intercepts network requests, and serves cached responses when offline
3. **Cache strategy** — which assets to pre-cache (app shell) and which to cache on first fetch (data)
4. **Background sync** — queues mutations (status updates, notes) made offline and replays them when online

---

## 1. Install vite-plugin-pwa

`vite-plugin-pwa` generates the service worker and manifest automatically from your Vite config.

```bash
npm install -D vite-plugin-pwa
```

---

## 2. Update vite.config.ts

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: [
				"favicon.ico",
				"apple-touch-icon.png",
				"icons/*.png",
			],
			manifest: {
				name: "DPH Plumbing Jobs",
				short_name: "DPH Jobs",
				description: "Job sheet management for DPH Plumbing",
				theme_color: "#0d0d0d",
				background_color: "#0d0d0d",
				display: "standalone",
				orientation: "portrait",
				start_url: "/",
				icons: [
					{
						src: "/icons/icon-192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "/icons/icon-512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "/icons/icon-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				// Pre-cache the app shell automatically
				globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
				// Runtime cache strategy for API calls
				runtimeCaching: [
					{
						// Cache Supabase REST API responses
						urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
						handler: "NetworkFirst",
						options: {
							cacheName: "supabase-api",
							expiration: {
								maxAgeSeconds: 60 * 60 * 24, // 24 hours
							},
							networkTimeoutSeconds: 5,
						},
					},
					{
						// Cache Supabase Storage (job photos)
						urlPattern:
							/^https:\/\/.*\.supabase\.co\/storage\/v1\//,
						handler: "CacheFirst",
						options: {
							cacheName: "job-photos",
							expiration: {
								maxEntries: 200,
								maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
							},
						},
					},
				],
			},
		}),
	],
});
```

---

## 3. App icons

Create a `public/icons/` folder and add two PNG icons:

| File                   | Size      | Usage                          |
| ---------------------- | --------- | ------------------------------ |
| `icon-192.png`         | 192 × 192 | Android home screen            |
| `icon-512.png`         | 512 × 512 | Android splash screen, iOS     |
| `apple-touch-icon.png` | 180 × 180 | iOS home screen (copy of icon) |

You can generate these quickly at [realfavicongenerator.net](https://realfavicongenerator.net) or [maskable.app](https://maskable.app/editor).

The DPH logo should be a simple design — orange square with "DPH" in white — on a dark background, ideally with the safe zone respected for maskable icons.

---

## 4. Register the service worker

`vite-plugin-pwa` with `registerType: 'autoUpdate'` handles this automatically via a virtual module. No manual code needed.

If you want to show an "App updated — reload" prompt, add to `main.tsx`:

```ts
import { registerSW } from "virtual:pwa-register";

registerSW({
	onNeedRefresh() {
		// Show a UI prompt asking user to reload
		if (confirm("App updated. Reload now?")) window.location.reload();
	},
	onOfflineReady() {
		console.log("App ready for offline use");
	},
});
```

Add the virtual module type declaration to `src/vite-env.d.ts`:

```ts
/// <reference types="vite-plugin-pwa/client" />
```

---

## 5. Offline data strategy (with Supabase)

### Pre-cache on morning login

When the engineer signs in, proactively cache their jobs for today and tomorrow into the browser's Cache API or IndexedDB:

```ts
// In AppContext.tsx, after successful login
async function warmCache(userId: string) {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	const tomorrowStr = tomorrow.toISOString().split("T")[0];

	await supabase
		.from("jobs")
		.select("*, profiles(*)")
		.eq("assigned_to", userId)
		.gte("date", TODAY)
		.lte("date", tomorrowStr);
	// Supabase Workbox handler caches the response automatically
}
```

### Background sync — offline mutations

When an engineer makes a change (status update, notes) while offline, you need to queue it and replay on reconnect.

Install the Workbox background sync plugin (included in workbox-background-sync):

```ts
// In vite.config.ts workbox section, add:
runtimeCaching: [
  {
    urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/jobs/,
    handler: 'NetworkOnly',
    options: {
      backgroundSync: {
        name: 'job-mutations-queue',
        options: {
          maxRetentionTime: 24 * 60, // retry for 24 hours
        },
      },
    },
    method: 'PATCH',
  },
],
```

Alternatively, implement a simple queue in `localStorage`:

```ts
// When offline, queue the update
function queueOfflineUpdate(jobId: string, fields: Partial<Job>) {
	const queue = JSON.parse(localStorage.getItem("offline-queue") ?? "[]");
	queue.push({ jobId, fields, timestamp: Date.now() });
	localStorage.setItem("offline-queue", JSON.stringify(queue));
}

// On reconnect, flush the queue
window.addEventListener("online", async () => {
	const queue = JSON.parse(localStorage.getItem("offline-queue") ?? "[]");
	for (const item of queue) {
		await supabase.from("jobs").update(item.fields).eq("id", item.jobId);
	}
	localStorage.removeItem("offline-queue");
});
```

---

## 6. iOS-specific notes

iOS Safari has supported PWAs, service workers, and push notifications since iOS 16.4. To ensure it works:

- The manifest must be referenced in `index.html` (Vite PWA plugin adds this automatically)
- Add to `index.html` `<head>`:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta
	name="apple-mobile-web-app-status-bar-style"
	content="black-translucent"
/>
<meta name="apple-mobile-web-app-title" content="DPH Jobs" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

The engineer must **Add to Home Screen** from Safari's share menu for the app to run in standalone mode and receive push notifications on iOS.

---

## 7. "Add to Home Screen" prompt

On Android, Chrome shows an automatic install prompt when PWA criteria are met. You can intercept it and show a custom prompt at the right moment (e.g. after the engineer's second login):

```ts
let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
	e.preventDefault();
	deferredPrompt = e as BeforeInstallPromptEvent;
	// Show your custom "Add to home screen" button
});

// When user clicks your button:
async function promptInstall() {
	if (!deferredPrompt) return;
	deferredPrompt.prompt();
	const { outcome } = await deferredPrompt.userChoice;
	deferredPrompt = null;
}
```

---

## 8. Testing offline mode

In Chrome DevTools:

1. Application tab → Service Workers — check the service worker is registered
2. Network tab → throttling → Offline
3. Refresh the page — the app should load from cache
4. Make a status change — check it queues (if background sync implemented) and syncs on reconnect

---

## Checklist

- [x] Install `vite-plugin-pwa`
- [x] Update `vite.config.ts` with PWA config (basic manifest + autoUpdate)
- [ ] Create `public/icons/` with 192, 512, and apple-touch-icon PNGs (currently using `vite.svg` placeholder)
- [ ] Update manifest in `vite.config.ts` with proper icon references
- [ ] Add Workbox runtime caching strategies for Supabase API and Storage
- [ ] Add apple meta tags to `index.html`
- [ ] Add `vite-env.d.ts` type reference for `virtual:pwa-register`
- [ ] Test service worker registration in DevTools
- [ ] Implement offline mutation queue
- [ ] Test "Add to Home Screen" on Android and iOS
- [ ] Confirm cached jobs load correctly with no network
