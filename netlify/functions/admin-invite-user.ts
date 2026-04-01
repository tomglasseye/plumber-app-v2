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

	// Verify caller identity and role using their JWT
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

	// Check caller is a master
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

	// Parse request body
	const { email, password, name, role, phone, homeAddress, avatar } =
		await request.json();

	if (!email || !password || !name) {
		return new Response(
			JSON.stringify({ error: "email, password and name are required" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	if (password.length < 8) {
		return new Response(
			JSON.stringify({ error: "Password must be at least 8 characters" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	// Use service role client for admin operations
	const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

	// Create the auth user (email_confirm: true so no confirmation email needed)
	const { data: newUser, error: createError } =
		await adminClient.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
		});

	if (createError || !newUser.user) {
		return new Response(
			JSON.stringify({ error: createError?.message ?? "Failed to create user" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const userId = newUser.user.id;

	// Derive initials from name if not provided
	const initials =
		avatar?.trim().toUpperCase().slice(0, 3) ||
		name
			.split(" ")
			.map((n: string) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 3);

	// Insert the profile row linked to the same business
	const { error: profileError } = await adminClient.from("profiles").insert({
		id: userId,
		email,
		name,
		role: role ?? "engineer",
		phone: phone ?? "",
		home_address: homeAddress ?? "",
		avatar: initials,
		business_id: callerProfile.business_id,
		locked: false,
		holiday_allowance: 28,
	});

	if (profileError) {
		// Roll back: delete the auth user we just created
		await adminClient.auth.admin.deleteUser(userId);
		return new Response(
			JSON.stringify({ error: profileError.message ?? "Failed to create profile" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	return new Response(
		JSON.stringify({ success: true, userId, name, email }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
