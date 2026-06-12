-- =============================================================
-- Migration 31: Guard businesses.plan from client-side writes
-- Run in Supabase → SQL Editor → New Query (after migration 30)
--
-- The "masters update own business" policy (1_schema.sql) is row-level with
-- no column restrictions, and the dashboard already tier-gates the SMS button
-- on plan = 'pro' (migration 28). Without this guard a master could set
-- plan='pro' via a direct API call — harmless today (SMS isn't built), a
-- billing bypass the day Stripe/SMS ship.
--
-- Allowed writers: service role (auth.uid() is null — e.g. the future Stripe
-- webhook, or this SQL editor per docs/STRIPE.md's "set plan directly" note)
-- and super admins. The Stripe migration will extend this guard to the
-- subscription_* / stripe_* columns it adds (see docs/STRIPE.md §2).
--
-- Idempotent: safe to run even if a variant of this guard was already
-- applied (create or replace + drop trigger if exists).
-- =============================================================

create or replace function guard_business_plan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Trusted server-side code (service role / SQL editor / dashboard).
  if auth.uid() is null then
    return new;
  end if;

  if new.plan is distinct from old.plan and not is_super_admin() then
    raise exception 'Plan changes are managed by billing and cannot be made from the app';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_business_plan on businesses;
create trigger guard_business_plan
  before update on businesses
  for each row execute function guard_business_plan();
