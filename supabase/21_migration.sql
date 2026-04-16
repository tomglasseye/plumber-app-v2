-- =============================================================
-- Migration 21: Superadmin infrastructure
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

-- Super-admin flag — separate from the business/role system
CREATE TABLE IF NOT EXISTS super_admins (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Only super admins can read this table
CREATE POLICY "super_admins read own row"
  ON super_admins FOR SELECT
  USING (id = auth.uid());

-- Helper function for RLS and Netlify Functions
CREATE OR REPLACE FUNCTION is_super_admin()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid())
$$;

-- To make someone a super admin (run manually):
-- INSERT INTO super_admins (id)
-- VALUES ((SELECT id FROM auth.users WHERE email = 'you@yourapp.com'));
