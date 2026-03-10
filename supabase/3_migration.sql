-- Migration: add accent_color to profiles
-- Run this in the Supabase SQL editor

alter table profiles
  add column if not exists accent_color text default '#f97316';

-- Migration: add job_id to notifications for click-through navigation
alter table notifications
  add column if not exists job_id uuid references jobs(id) on delete set null;
