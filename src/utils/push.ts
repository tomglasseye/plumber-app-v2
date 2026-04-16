import { supabase } from "../supabase";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding)
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const rawData = atob(base64);
	return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Subscribe the current user to Web Push notifications.
 * Requests permission if not already granted, registers the push subscription,
 * and saves it to Supabase for the server to target.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
	if (!("serviceWorker" in navigator) || !("PushManager" in window))
		return false;

	const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
	if (!vapidKey) return false;

	const permission = await Notification.requestPermission();
	if (permission !== "granted") return false;

	const registration = await navigator.serviceWorker.ready;

	const keyArray = urlBase64ToUint8Array(vapidKey);
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: keyArray.buffer as ArrayBuffer,
	});

	const p256dh = subscription.getKey("p256dh");
	const auth = subscription.getKey("auth");
	if (!p256dh || !auth) return false;

	await supabase.from("push_subscriptions").upsert({
		user_id: userId,
		endpoint: subscription.endpoint,
		p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
		auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
	});

	return true;
}

/**
 * Fire a push notification to a target user via the Netlify Function.
 * Non-blocking — errors are silently ignored.
 */
export async function firePush(
	userId: string,
	title: string,
	body: string,
	url?: string,
): Promise<void> {
	const { data: { session } } = await supabase.auth.getSession();
	if (!session?.access_token) return;

	fetch("/.netlify/functions/send-push", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.access_token}`,
		},
		body: JSON.stringify({ userId, title, body, url }),
	}).catch(() => {});
}
