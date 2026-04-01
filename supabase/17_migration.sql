-- =============================================================
-- Migration 17: Holiday approval workflow + annual allowance
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

-- 1. Add status column to team_holidays (default 'approved' for backward compat)
ALTER TABLE team_holidays
  ADD COLUMN IF NOT EXISTS status text
    DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'declined'));

-- 2. Add holiday_allowance to profiles (UK standard: 28 days)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS holiday_allowance integer DEFAULT 28;

-- 3. Engineers can INSERT their own holidays (as pending)
DROP POLICY IF EXISTS "engineers insert own holidays" ON team_holidays;
CREATE POLICY "engineers insert own holidays"
  ON team_holidays FOR INSERT
  WITH CHECK (
    business_id = my_business_id()
    AND profile_id = auth.uid()
    AND status = 'pending'
  );

-- 4. Engineers can UPDATE their own PENDING holidays (edit before approval)
DROP POLICY IF EXISTS "engineers update own pending holidays" ON team_holidays;
CREATE POLICY "engineers update own pending holidays"
  ON team_holidays FOR UPDATE
  USING (
    business_id = my_business_id()
    AND profile_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    business_id = my_business_id()
    AND profile_id = auth.uid()
    AND status = 'pending'
  );

-- 5. Engineers can DELETE their own PENDING holidays (cancel request)
DROP POLICY IF EXISTS "engineers delete own pending holidays" ON team_holidays;
CREATE POLICY "engineers delete own pending holidays"
  ON team_holidays FOR DELETE
  USING (
    business_id = my_business_id()
    AND profile_id = auth.uid()
    AND status = 'pending'
  );
