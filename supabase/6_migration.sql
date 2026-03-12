-- =============================================================
-- Migration 6: Repeat Tasks (annual boiler services etc.)
-- =============================================================

create table if not exists repeat_tasks (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid references businesses(id) on delete cascade not null,
  customer          text not null,
  address           text not null,
  type              text not null default 'Boiler Service',
  description       text default '',
  frequency         text check (frequency in ('annually', 'biannually', 'quarterly')) default 'annually',
  next_due_date     date not null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Auto-update updated_at
drop trigger if exists repeat_tasks_updated_at on repeat_tasks;
create trigger repeat_tasks_updated_at
  before update on repeat_tasks
  for each row execute function update_updated_at();

-- Add repeat_task_id to notifications so clicks can link to a reminder
alter table notifications add column if not exists repeat_task_id uuid references repeat_tasks(id) on delete set null;

-- RLS
alter table repeat_tasks enable row level security;

create policy "masters read repeat_tasks"
  on repeat_tasks for select
  using (business_id = my_business_id() and is_master());

create policy "masters insert repeat_tasks"
  on repeat_tasks for insert
  with check (business_id = my_business_id() and is_master());

create policy "masters update repeat_tasks"
  on repeat_tasks for update
  using (business_id = my_business_id() and is_master())
  with check (business_id = my_business_id() and is_master());

create policy "masters delete repeat_tasks"
  on repeat_tasks for delete
  using (business_id = my_business_id() and is_master());
