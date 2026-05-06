import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

// 100 years — Supabase's ban_duration is a Go time.Duration string.
const FOREVER = "876000h";

export default async (request: Request) => {
	if (request.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: { "Content-Type": "application/json" },
		});
	}

	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return new Response(JSON.stringify({ error: "Missing auth token" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
		global: { headers: { Authorization: `Bearer ${authHeader.slice(7)}` } },
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

	const { data: callerProfile } = await callerClient
		.from("profiles")
		.select("role, business_id")
		.eq("id", caller.id)
		.single();

	if (!callerProfile || callerProfile.role !== "master") {
		return new Response(JSON.stringify({ error: "Not authorised" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { userId, locked } = await request.json();
	if (typeof userId !== "string" || typeof locked !== "boolean") {
		return new Response(
			JSON.stringify({ error: "userId (string) and locked (boolean) required" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	if (userId === caller.id) {
		return new Response(
			JSON.stringify({ error: "Cannot lock your own account" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const { data: targetProfile } = await callerClient
		.from("profiles")
		.select("business_id")
		.eq("id", userId)
		.single();

	if (!targetProfile || targetProfile.business_id !== callerProfile.business_id) {
		return new Response(
			JSON.stringify({ error: "User not in your business" }),
			{ status: 403, headers: { "Content-Type": "application/json" } },
		);
	}

	const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

	// Flip the auth-layer ban first so existing refresh tokens stop working,
	// then mirror the state into profiles.locked for RLS / UI use.
	const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
		ban_duration: locked ? FOREVER : "none",
	});
	if (banError) {
		return new Response(JSON.stringify({ error: banError.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { error: profileError } = await adminClient
		.from("profiles")
		.update({ locked })
		.eq("id", userId);
	if (profileError) {
		return new Response(JSON.stringify({ error: profileError.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
