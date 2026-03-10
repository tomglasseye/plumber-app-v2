-- =============================================================
-- DPH Plumbing App — Schema
-- Run this FIRST in Supabase → SQL Editor → New Query
-- =============================================================

-- ─────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────

create table if not exists businesses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  email         text,
  address       text,
  vat_number    text,
  accent_color  text default '#f97316',
  logo_initials text default 'BIZ',
  xero_connected boolean default false,
  xero_email    text,
  created_at    timestamptz default now()
);

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  business_id  uuid references businesses(id) on delete cascade,
  name         text not null,
  phone        text,
  role         text check (role in ('master', 'engineer')) default 'engineer',
  avatar       text,        -- two-letter initials e.g. "DH"
  home_address text,
  created_at   timestamptz default now()
);

create table if not exists jobs (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid references businesses(id) on delete cascade not null,
  ref              text not null,
  customer         text not null,
  address          text not null,
  type             text not null,
  description      text default '',
  assigned_to      uuid references profiles(id),
  status           text check (status in (
                     'Scheduled', 'En Route', 'On Site', 'Completed', 'Invoiced'
                   )) default 'Scheduled',
  priority         text check (priority in (
                     'Emergency', 'High', 'Normal', 'Low'
                   )) default 'Normal',
  date             date not null,
  materials        text default '',
  notes            text default '',
  time_spent       numeric(5,2) default 0,
  ready_to_invoice boolean default false,
  xero_invoice_id  text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table if not exists job_photos (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references jobs(id) on delete cascade not null,
  storage_path text not null,
  caption      text default '',
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz default now()
);

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  for_user    uuid references profiles(id),
  for_role    text,
  icon        text default '🔔',
  message     text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 2. FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────

-- Auto-update updated_at on jobs
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_updated_at on jobs;
create trigger jobs_updated_at
  before update on jobs
  for each row execute function update_updated_at();

-- Helper: get the calling user's business_id
create or replace function my_business_id()
returns uuid as $$
  select business_id from profiles where id = auth.uid()
$$ language sql stable security definer;

-- ─────────────────────────────────────────────
-- 3. ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────

alter table businesses    enable row level security;
alter table profiles      enable row level security;
alter table jobs          enable row level security;
alter table job_photos    enable row level security;
alter table notifications enable row level security;

-- businesses
drop policy if exists "members read own business"    on businesses;
drop policy if exists "masters update own business"  on businesses;

create policy "members read own business"
  on businesses for select
  using (id = my_business_id());

create policy "masters update own business"
  on businesses for update
  using (
    id = my_business_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'master')
  );

-- profiles
drop policy if exists "members read own business profiles" on profiles;
drop policy if exists "masters insert profiles"            on profiles;

create policy "members read own business profiles"
  on profiles for select
  using (business_id = my_business_id());

create policy "masters insert profiles"
  on profiles for insert
  with check (
    business_id = my_business_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'master')
  );

-- jobs
drop policy if exists "members read business jobs"  on jobs;
drop policy if exists "engineers update own jobs"   on jobs;
drop policy if exists "masters insert jobs"         on jobs;

create policy "members read business jobs"
  on jobs for select
  using (business_id = my_business_id());

create policy "engineers update own jobs"
  on jobs for update
  using (
    business_id = my_business_id() and (
      assigned_to = auth.uid() or
      exists (select 1 from profiles where id = auth.uid() and role = 'master')
    )
  );

create policy "masters insert jobs"
  on jobs for insert
  with check (
    business_id = my_business_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'master')
  );

-- job_photos
drop policy if exists "members read job photos"   on job_photos;
drop policy if exists "members insert job photos" on job_photos;

create policy "members read job photos"
  on job_photos for select
  using (exists (
    select 1 from jobs j
    where j.id = job_id and j.business_id = my_business_id()
  ));

create policy "members insert job photos"
  on job_photos for insert
  with check (exists (
    select 1 from jobs j
    where j.id = job_id and j.business_id = my_business_id()
  ));

-- notifications
drop policy if exists "users read own notifications"   on notifications;
drop policy if exists "masters insert notifications"   on notifications;
drop policy if exists "engineers insert notifications" on notifications;

create policy "users read own notifications"
  on notifications for select
  using (
    business_id = my_business_id() and (
      for_user = auth.uid() or (
        for_role = 'master' and
        exists (select 1 from profiles where id = auth.uid() and role = 'master')
      )
    )
  );

create policy "members insert notifications"
  on notifications for insert
  with check (business_id = my_business_id());

create policy "members update notifications"
  on notifications for update
  using (business_id = my_business_id());
