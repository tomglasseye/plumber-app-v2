-- =============================================================
-- Migration 12: Unify repeat tasks into jobs
--   1. Drop legacy `type` column from jobs (removed from app)
--   2. Add repeat_frequency to jobs
--   3. Drop repeat_tasks table
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

-- Drop the legacy type column (no longer used in app)
alter table jobs drop column if exists type;

-- Add repeat frequency to jobs
alter table jobs
  add column if not exists repeat_frequency text
    check (repeat_frequency in ('annually', 'biannually', 'quarterly'));

-- Drop the separate repeat_tasks table
drop table if exists repeat_tasks;
