-- =============================================================
-- Migration 26: Actual job timestamps
-- Records when an engineer advances a job through its statuses, so
-- the calendar can show the real on-site window and we can split:
--   • on-site (billable) time  = completed_at − on_site_at   → timeSpent / invoice
--   • total worked time        = completed_at − en_route_at  → engineer timesheet/pay
-- Scheduled start_time/end_time are left untouched (the master's plan).
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

alter table jobs add column if not exists en_route_at  timestamptz;
alter table jobs add column if not exists on_site_at   timestamptz;
alter table jobs add column if not exists completed_at timestamptz;
