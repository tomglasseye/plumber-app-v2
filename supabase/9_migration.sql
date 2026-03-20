-- =============================================================
-- Migration 9: Job categories, team holidays, and scheduling
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

-- ─────────────────────────────────────────────
-- 1. JOB CATEGORIES
-- ─────────────────────────────────────────────

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name        text not null,
  icon        text not null default 'Wrench',
  color       text not null default '#f97316',
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table categories enable row level security;

drop policy if exists "members read categories"   on categories;
drop policy if exists "masters insert categories" on categories;
drop policy if exists "masters update categories" on categories;
drop policy if exists "masters delete categories" on categories;

create policy "members read categories"
  on categories for select
  using (business_id = my_business_id());

create policy "masters insert categories"
  on categories for insert
  with check (
    business_id = my_business_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'master')
  );

create policy "masters update categories"
  on categories for update
  using (
    business_id = my_business_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'master')
  );

create policy "masters delete categories"
  on categories for delete
  using (
    business_id = my_business_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'master')
  );

-- ─────────────────────────────────────────────
-- 2. TEAM HOLIDAYS / LEAVE
-- ─────────────────────────────────────────────

create table if not exists team_holidays (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  profile_id  uuid references profiles(id) on delete cascade not null,
  date        date not null,
  half_day    boolean default false,
  label       text default 'Holiday',
  created_at  timestamptz default now()
);

alter table team_holidays enable row level security;

drop policy if exists "members read holidays"   on team_holidays;
drop policy if exists "masters insert holidays" on team_holidays;
drop policy if exists "masters update holidays" on team_holidays;
drop policy if exists "masters delete holidays" on team_holidays;

create policy "members read holidays"
  on team_holidays for select
  using (business_id = my_business_id());

create policy "masters insert holidays"
  on team_holidays for insert
  with check (
    business_id = my_business_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'master')
  );

create policy "masters update holidays"
  on team_holidays for update
  using (
    business_id = my_business_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'master')
  );

create policy "masters delete holidays"
  on team_holidays for delete
  using (
    business_id = my_business_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'master')
  );

-- ─────────────────────────────────────────────
-- 3. JOB SCHEDULING COLUMNS
-- ─────────────────────────────────────────────

-- Category reference
alter table jobs
  add column if not exists category_id uuid references categories(id) on delete set null;

-- Timeslot (stored as 'HH:MM' text, e.g. '09:00', '14:30')
alter table jobs
  add column if not exists start_time text;

alter table jobs
  add column if not exists end_time text;

-- End date (for multi-day jobs or early-completion override)
alter table jobs
  add column if not exists end_date date;
