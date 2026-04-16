-- =============================================================
-- Migration 22: Super-admin RLS bypass
-- Allows super_admins to read/write ALL businesses, profiles,
-- jobs, customers, categories, holidays, notifications, photos.
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

-- ── businesses ──────────────────────────────────────────────
CREATE POLICY "super_admins read all businesses"
  ON businesses FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admins update all businesses"
  ON businesses FOR UPDATE
  USING (is_super_admin());

-- ── profiles ────────────────────────────────────────────────
CREATE POLICY "super_admins read all profiles"
  ON profiles FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admins insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "super_admins update profiles"
  ON profiles FOR UPDATE
  USING (is_super_admin());

-- ── jobs ────────────────────────────────────────────────────
CREATE POLICY "super_admins read all jobs"
  ON jobs FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admins insert jobs"
  ON jobs FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "super_admins update jobs"
  ON jobs FOR UPDATE
  USING (is_super_admin());

-- ── job_photos ──────────────────────────────────────────────
CREATE POLICY "super_admins read all job_photos"
  ON job_photos FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admins insert job_photos"
  ON job_photos FOR INSERT
  WITH CHECK (is_super_admin());

-- ── customers ───────────────────────────────────────────────
CREATE POLICY "super_admins read all customers"
  ON customers FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admins insert customers"
  ON customers FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "super_admins update customers"
  ON customers FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "super_admins delete customers"
  ON customers FOR DELETE
  USING (is_super_admin());

-- ── categories ──────────────────────────────────────────────
CREATE POLICY "super_admins read all categories"
  ON categories FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admins insert categories"
  ON categories FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "super_admins update categories"
  ON categories FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "super_admins delete categories"
  ON categories FOR DELETE
  USING (is_super_admin());

-- ── notifications ───────────────────────────────────────────
CREATE POLICY "super_admins read all notifications"
  ON notifications FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admins insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "super_admins update notifications"
  ON notifications FOR UPDATE
  USING (is_super_admin());

-- ── team_holidays ───────────────────────────────────────────
CREATE POLICY "super_admins read all holidays"
  ON team_holidays FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super_admins insert holidays"
  ON team_holidays FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "super_admins update holidays"
  ON team_holidays FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "super_admins delete holidays"
  ON team_holidays FOR DELETE
  USING (is_super_admin());
