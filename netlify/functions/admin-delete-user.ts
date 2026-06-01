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

	const { userId } = await request.json();

	if (!userId) {
		return new Response(JSON.stringify({ error: "userId required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	if (userId === caller.id) {
		return new Response(
			JSON.stringify({ error: "You cannot delete your own account" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	// Authorisation: super admins may delete any user; otherwise the caller must
	// be a master and may only delete users within their own business.
	const { data: superAdminRow } = await adminClient
		.from("super_admins")
		.select("id")
		.eq("id", caller.id)
		.maybeSingle();
	const isSuperAdmin = !!superAdminRow;

	if (!isSuperAdmin) {
		const { data: callerProfile } = await adminClient
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

		const { data: targetProfile } = await adminClient
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
	}

	// Clear references that would otherwise block the profile delete (these FKs
	// have no cascade). Assigned jobs become unassigned; the user's notifications
	// are removed; uploaded photos keep but lose the uploader link.
	await adminClient.from("jobs").update({ assigned_to: null }).eq("assigned_to", userId);
	await adminClient.from("notifications").delete().eq("for_user", userId);
	await adminClient.from("job_photos").update({ uploaded_by: null }).eq("uploaded_by", userId);

	// Delete the auth user — the profile row cascades (profiles.id → auth.users
	// ON DELETE CASCADE), removing the orphaned-auth-user problem.
	const { error } = await adminClient.auth.admin.deleteUser(userId);

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
