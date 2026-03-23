-- =============================================================
-- Migration 16: Audit log table
-- Records admin actions: profile deletes, lock/unlock, password
-- changes, and business settings updates.
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,        -- e.g. 'profile.delete', 'auth.password_change'
  target_type text,                 -- 'profile', 'business', etc.
  target_id   text,                 -- UUID of affected record
  details     jsonb,                -- optional structured data
  created_at  timestamptz default now()
);

alter table audit_log enable row level security;

-- Masters can read their own business's audit log
create policy "masters read audit log"
  on audit_log for select
  using (business_id = my_business_id() and is_master());

-- No direct INSERT from client — only via the security-definer function below.
-- This prevents a compromised client from forging or suppressing audit records.

create or replace function log_audit_event(
  p_action      text,
  p_target_type text default null,
  p_target_id   text default null,
  p_details     jsonb default null
) returns void
  language plpgsql
  security definer
as $$
begin
  insert into audit_log (business_id, actor_id, action, target_type, target_id, details)
  select
    (select business_id from profiles where id = auth.uid()),
    auth.uid(),
    p_action,
    p_target_type,
    p_target_id,
    p_details;
end;
$$;
