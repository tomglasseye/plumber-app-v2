-- =============================================================
-- Migration 8: Customers / Contacts table
-- =============================================================

create table if not exists customers (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references businesses(id) on delete cascade not null,
  name            text not null,
  email           text not null,
  phone           text default '',
  address         text default '',
  notes           text default '',
  xero_contact_id text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-update updated_at
drop trigger if exists customers_updated_at on customers;
create trigger customers_updated_at
  before update on customers
  for each row execute function update_updated_at();

-- RLS
alter table customers enable row level security;

create policy "members read customers"
  on customers for select
  using (business_id = my_business_id());

create policy "masters insert customers"
  on customers for insert
  with check (business_id = my_business_id() and is_master());

create policy "masters update customers"
  on customers for update
  using (business_id = my_business_id() and is_master())
  with check (business_id = my_business_id() and is_master());

create policy "masters delete customers"
  on customers for delete
  using (business_id = my_business_id() and is_master());

-- Add customer_id FK to jobs (nullable for existing rows)
alter table jobs add column if not exists customer_id uuid references customers(id) on delete set null;

-- Add customer_id FK to repeat_tasks (nullable for existing rows)
alter table repeat_tasks add column if not exists customer_id uuid references customers(id) on delete set null;
