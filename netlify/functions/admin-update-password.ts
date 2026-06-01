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

	// Verify the caller is authenticated
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return new Response(JSON.stringify({ error: "Missing auth token" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const token = authHeader.slice(7);

	// Service-role client for all DB operations — bypasses RLS reliably in
	// serverless cold-start contexts where the user JWT client can silently fail.
	const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

	// Verify the caller's JWT is genuine via Supabase auth
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

	// Check if caller is a super admin — they can update any user's password
	const { data: superAdminRow } = await adminClient
		.from("super_admins")
		.select("id")
		.eq("id", caller.id)
		.maybeSingle();

	const isSuperAdmin = !!superAdminRow;

	// If not a super admin, verify caller is a master in a business
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

	// Parse request body
	const { userId, password } = await request.json();

	if (!userId || !password) {
		return new Response(
			JSON.stringify({ error: "userId and password required" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	// Masters can only update users in their own business; super admins are unrestricted
	if (!isSuperAdmin) {
		const { data: targetProfile } = await adminClient
			.from("profiles")
			.select("business_id")
			.eq("id", userId)
			.single();

		if (!targetProfile || targetProfile.business_id !== callerBusinessId) {
			return new Response(
				JSON.stringify({ error: "User not in your business" }),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	}

	const { error } = await adminClient.auth.admin.updateUserById(userId, {
		password,
	});

	if (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
