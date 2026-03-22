-- =============================================================
-- Migration 13: Working hours on businesses
-- Allows master users to configure the team's work day start/end
-- times, which control the calendar time grid and time slot options.
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

alter table businesses
  add column if not exists work_day_start smallint default 7
    check (work_day_start >= 0 and work_day_start <= 23),
  add column if not exists work_day_end smallint default 17
    check (work_day_end >= 1 and work_day_end <= 24);
