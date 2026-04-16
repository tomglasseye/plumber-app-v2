import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const vapidPublic = process.env.VAPID_PUBLIC_KEY!;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY!;
const vapidMailto = process.env.VAPID_MAILTO ?? "mailto:admin@example.com";

if (vapidPublic && vapidPrivate) {
	webpush.setVapidDetails(vapidMailto, vapidPublic, vapidPrivate);
}

export default async (request: Request, _context: Context) => {
	if (request.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: { "Content-Type": "application/json" },
		});
	}

	if (!vapidPublic || !vapidPrivate) {
		return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	// ── Verify the caller is authenticated ──────────────────────
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return new Response(JSON.stringify({ error: "Missing auth token" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const token = authHeader.slice(7);
	const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
		global: { headers: { Authorization: `Bearer ${token}` } },
	});

	const {
		data: { user: caller },
	} = await callerClient.auth.getUser();

	if (!caller) {
		return new Response(JSON.stringify({ error: "Invalid token" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	// ── Verify the target user is in the same business ──────────
	const { userId, title, body, url } = await request.json();

	if (!userId || !title) {
		return new Response(JSON.stringify({ error: "Missing userId or title" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const adminClient = createClient(supabaseUrl, supabaseServiceKey);

	const { data: callerProfile } = await adminClient
		.from("profiles")
		.select("business_id")
		.eq("id", caller.id)
		.single();

	const { data: targetProfile } = await adminClient
		.from("profiles")
		.select("business_id")
		.eq("id", userId)
		.single();

	if (
		!callerProfile ||
		!targetProfile ||
		callerProfile.business_id !== targetProfile.business_id
	) {
		return new Response(JSON.stringify({ error: "Forbidden" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}

	// ── Send the push ───────────────────────────────────────────
	const { data: subs } = await adminClient
		.from("push_subscriptions")
		.select("*")
		.eq("user_id", userId);

	if (!subs?.length) {
		return new Response(JSON.stringify({ sent: 0 }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	const results = await Promise.allSettled(
		subs.map((sub) =>
			webpush
				.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: { p256dh: sub.p256dh, auth: sub.auth },
					},
					JSON.stringify({ title, body, url }),
				)
				.catch(() => {
					// Subscription expired or invalid — remove it
					adminClient
						.from("push_subscriptions")
						.delete()
						.eq("endpoint", sub.endpoint);
				}),
		),
	);

	const sent = results.filter((r) => r.status === "fulfilled").length;

	return new Response(JSON.stringify({ sent }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
