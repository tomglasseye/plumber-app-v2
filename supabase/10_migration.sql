-- =============================================================
-- Migration 10: Holiday type (holiday / sick / training / other)
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

alter table team_holidays
  add column if not exists type text
    default 'holiday'
    check (type in ('holiday', 'sick', 'training', 'other'));
