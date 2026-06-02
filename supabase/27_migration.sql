-- =============================================================
-- Migration 27: Add email column to profiles
-- The app expects profiles.email (mapProfile reads it, admin-invite-user
-- inserts it, the Team list displays it), but no migration ever created
-- the column — so adding a team member fails with:
--   "Could not find the 'email' column of 'profiles' in the schema cache"
-- This adds the column and backfills existing rows from the auth user.
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

alter table profiles add column if not exists email text;

-- Backfill existing profiles from their auth.users record.
update profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');
