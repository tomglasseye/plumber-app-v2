// Push notification handler for the service worker.
// This file is loaded by the main service worker via importScripts.

self.addEventListener("push", (event) => {
	const data = event.data?.json() ?? {};
	event.waitUntil(
		self.registration.showNotification(data.title ?? "Job Update", {
			body: data.body ?? "",
			icon: "/android-chrome-192x192.png",
			badge: "/android-chrome-192x192.png",
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
				if (client.url.includes(url) && "focus" in client) {
					return client.focus();
				}
			}
			if (clients.openWindow) return clients.openWindow(url);
		}),
	);
});
