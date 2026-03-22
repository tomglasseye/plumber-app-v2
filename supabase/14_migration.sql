-- =============================================================
-- Migration 14: User locking
-- Adds a locked flag to profiles so master users can suspend
-- access without deleting the account.
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

alter table profiles
  add column if not exists locked boolean not null default false;
