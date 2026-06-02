import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export default async (request: Request, _context: Context) => {
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

	const token = authHeader.slice(7);

	const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

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

	// Only super admins (any user) or masters (own business) may change emails.
	const { data: superAdminRow } = await adminClient
		.from("super_admins")
		.select("id")
		.eq("id", caller.id)
		.maybeSingle();
	const isSuperAdmin = !!superAdminRow;

	let callerBusinessId: string | null = null;
	if (!isSuperAdmin) {
		const { data: profile } = await adminClient
			.from("profiles")
			.select("role, business_id")
			.eq("id", caller.id)
			.single();

		if (!profile || profile.role !== "master") {
			return new Response(JSON.stringify({ error: "Not authorised" }), {
				status: 403,
				headers: { "Content-Type": "application/json" },
			});
		}
		callerBusinessId = profile.business_id;
	}

	const { userId, email } = await request.json();

	if (!userId || !email) {
		return new Response(
			JSON.stringify({ error: "userId and email are required" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return new Response(JSON.stringify({ error: "Invalid email address" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Masters can only edit users in their own business.
	if (!isSuperAdmin) {
		const { data: targetProfile } = await adminClient
			.from("profiles")
			.select("business_id")
			.eq("id", userId)
			.single();

		if (!targetProfile || targetProfile.business_id !== callerBusinessId) {
			return new Response(
				JSON.stringify({ error: "User not in your business" }),
				{ status: 403, headers: { "Content-Type": "application/json" } },
			);
		}
	}

	// Update the auth login email (confirmed immediately) and the profile copy.
	const { error: authError } = await adminClient.auth.admin.updateUserById(
		userId,
		{ email, email_confirm: true },
	);

	if (authError) {
		return new Response(JSON.stringify({ error: authError.message }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { error: profileError } = await adminClient
		.from("profiles")
		.update({ email })
		.eq("id", userId);

	if (profileError) {
		return new Response(JSON.stringify({ error: profileError.message }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
