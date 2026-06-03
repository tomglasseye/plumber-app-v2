-- =============================================================
-- Migration 28: Reminders table + business plan / tier flag
-- Run in Supabase → SQL Editor → New Query (after migration 27)
-- =============================================================

-- ─────────────────────────────────────────────
-- 1. Business plan / tier flag
--    Every existing client defaults to 'starter' (Tier 1).
--    NOTE: the future Stripe migration (see docs/STRIPE.md §2) lists `plan`
--    among its columns — it must NOT re-add it; this column already exists
--    from here on. Stripe's webhook simply writes to it.
-- ─────────────────────────────────────────────
alter table businesses
  add column if not exists plan text
    check (plan in ('starter', 'pro'))
    default 'starter';

-- ─────────────────────────────────────────────
-- 2. Reminders — free-form HQ reminders shown on the master dashboard.
--    Auto-surfaced events (engineers off, recurring services due) are NOT
--    stored here; they're computed live from team_holidays / jobs. This
--    table is only for ad-hoc reminders HQ types in.
-- ─────────────────────────────────────────────
create table if not exists reminders (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  title       text not null,
  body        text default '',
  due_date    date,                                              -- nullable: undated reminders allowed
  customer_id uuid references customers(id) on delete set null,  -- optional link (used by future SMS "Send reminder")
  status      text check (status in ('open', 'done', 'dismissed')) default 'open',
  created_by  uuid references profiles(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists reminders_business_id_idx on reminders (business_id);

-- Auto-update updated_at (reuses the shared trigger function from 1_schema.sql)
drop trigger if exists reminders_updated_at on reminders;
create trigger reminders_updated_at
  before update on reminders
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- 3. Row-level security — mirrors the customers table:
--    everyone in the business can read; only masters can write.
-- ─────────────────────────────────────────────
alter table reminders enable row level security;

drop policy if exists "members read reminders"  on reminders;
drop policy if exists "masters insert reminders" on reminders;
drop policy if exists "masters update reminders" on reminders;
drop policy if exists "masters delete reminders" on reminders;

create policy "members read reminders"
  on reminders for select
  using (business_id = my_business_id());

create policy "masters insert reminders"
  on reminders for insert
  with check (business_id = my_business_id() and is_master());

create policy "masters update reminders"
  on reminders for update
  using (business_id = my_business_id() and is_master())
  with check (business_id = my_business_id() and is_master());

create policy "masters delete reminders"
  on reminders for delete
  using (business_id = my_business_id() and is_master());

-- ─────────────────────────────────────────────
-- 4. Grants — explicit, per the Oct 30 2026 Data API exposure policy
--    (see SUPABASE_STATUS.md). RLS above still scopes every row per business.
-- ─────────────────────────────────────────────
grant select, insert, update, delete on public.reminders to authenticated;

-- ─────────────────────────────────────────────
-- 5. Realtime — live sync of reminders across HQ devices.
--    REPLICA IDENTITY FULL so UPDATE payloads carry the complete row
--    (matches jobs / team_holidays from migration 18; the client's UPDATE
--    handler maps payload.new and needs every column).
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table reminders;
alter table reminders replica identity full;
