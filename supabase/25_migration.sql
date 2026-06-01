-- =============================================================
-- Migration 25: Restrict engineers to their own jobs (read)
-- Engineers may only SELECT jobs assigned to them or unassigned.
-- Masters still read every job in their business; super admins are
-- unaffected (separate is_super_admin() policy — migration 22).
-- This enforces at the database what the calendar already does in
-- the UI (myJobs), so engineers can't read other engineers' jobs
-- via the API.
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

drop policy if exists "members read business jobs" on jobs;

create policy "members read business jobs"
  on jobs for select
  using (
    business_id = my_business_id() and (
      -- Masters read all jobs in their business
      exists (
        select 1 from profiles
        where id = auth.uid() and role = 'master'
      )
      -- Engineers read only their own jobs, plus unassigned ones
      or assigned_to = auth.uid()
      or assigned_to is null
    )
  );
