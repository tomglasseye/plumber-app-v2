-- =============================================================
-- Migration 11: Multi-day holidays (end_date on team_holidays)
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

alter table team_holidays
  add column if not exists end_date date;
