import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as
	| string
	| undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client — only available when VITE_SUPABASE_SERVICE_KEY is set.
// Used exclusively for master-level operations such as resetting another
// user's password. Keep this key out of public/client bundles in
// publicly accessible apps; for an internal-only tool this is acceptable.
export const supabaseAdmin = supabaseServiceKey
	? createClient(supabaseUrl, supabaseServiceKey, {
			auth: { autoRefreshToken: false, persistSession: false },
		})
	: null;
