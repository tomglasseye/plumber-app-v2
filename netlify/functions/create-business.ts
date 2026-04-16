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

	// Verify caller is a super admin
	const { data: saRow } = await callerClient
		.from("super_admins")
		.select("id")
		.eq("id", caller.id)
		.maybeSingle();

	if (!saRow) {
		return new Response(JSON.stringify({ error: "Forbidden — super admin required" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}

	const {
		name,
		phone,
		email,
		address,
		accentColor,
		logoInitials,
		masterEmail,
		masterName,
	} = await request.json();

	if (!name || !masterEmail || !masterName) {
		return new Response(
			JSON.stringify({ error: "Missing required fields: name, masterEmail, masterName" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const adminClient = createClient(supabaseUrl, supabaseServiceKey);

	// Create business row
	const { data: biz, error: bizErr } = await adminClient
		.from("businesses")
		.insert({
			name,
			phone: phone ?? "",
			email: email ?? "",
			address: address ?? "",
			accent_color: accentColor ?? "#f97316",
			logo_initials: logoInitials ?? name.slice(0, 3).toUpperCase(),
		})
		.select()
		.single();

	if (bizErr) {
		return new Response(JSON.stringify({ error: bizErr.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Invite the master user — they get an email to set their password
	const { data: invite, error: inviteErr } =
		await adminClient.auth.admin.inviteUserByEmail(masterEmail, {
			data: {
				business_id: biz.id,
				role: "master",
				name: masterName,
			},
		});

	if (inviteErr) {
		return new Response(JSON.stringify({ error: inviteErr.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Pre-create the master's profile row
	const avatar = masterName
		.split(" ")
		.map((n: string) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	await adminClient.from("profiles").insert({
		id: invite.user.id,
		business_id: biz.id,
		name: masterName,
		role: "master",
		avatar,
	});

	return new Response(
		JSON.stringify({ businessId: biz.id, message: `Invite sent to ${masterEmail}` }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
