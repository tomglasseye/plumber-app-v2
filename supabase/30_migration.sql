-- =============================================================
-- Migration 30: Delete policies, invoice-gate enforcement,
--               ref uniqueness, nullable job dates, and a fix to
--               the migration-24 profile guard for service-role calls.
-- Run in Supabase → SQL Editor → New Query (after migration 29)
-- =============================================================

-- ─────────────────────────────────────────────
-- 1. DELETE policies for jobs and job_photos
--    Neither table ever had a DELETE policy, so client deletes were
--    silently blocked by RLS (0 rows affected, no error): deleted jobs
--    reappeared on reload, and photo deletes removed the Storage object
--    but left the job_photos row behind — which still counted toward
--    the 2-photo limit trigger, permanently blocking the slot.
-- ─────────────────────────────────────────────

drop policy if exists "masters delete jobs" on jobs;
create policy "masters delete jobs"
  on jobs for delete
  using (business_id = my_business_id() and is_master());

drop policy if exists "super_admins delete jobs" on jobs;
create policy "super_admins delete jobs"
  on jobs for delete
  using (is_super_admin());

-- Masters can delete any photo in their business; engineers only their own
-- uploads (mirrors the canDelete check in JobPhotos.tsx).
drop policy if exists "masters and uploaders delete job photos" on job_photos;
create policy "masters and uploaders delete job photos"
  on job_photos for delete
  using (
    exists (
      select 1 from jobs j
      where j.id = job_id and j.business_id = my_business_id()
    )
    and (is_master() or uploaded_by = auth.uid())
  );

drop policy if exists "super_admins delete job_photos" on job_photos;
create policy "super_admins delete job_photos"
  on job_photos for delete
  using (is_super_admin());

-- ─────────────────────────────────────────────
-- 2. Enforce the Final Complete → Xero gate in the database
--    The "engineers update own jobs" policy (1_schema.sql) is row-level,
--    not column-level: an engineer could set ready_to_invoice = true or
--    status = 'Invoiced' via a direct API call, bypassing HQ approval.
--    This trigger rejects those changes unless the caller is a master or
--    super admin (same pattern as guard_profile_sensitive_columns).
-- ─────────────────────────────────────────────

create or replace function guard_job_invoice_gate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Service-role / SQL-editor sessions have no auth.uid(). RLS already
  -- keeps anonymous clients out entirely, so a null uid here means trusted
  -- server-side code (Netlify Functions) or the dashboard — allow it.
  if auth.uid() is null then
    return new;
  end if;

  if (new.ready_to_invoice is distinct from old.ready_to_invoice)
     or (new.status = 'Invoiced' and old.status is distinct from new.status) then
    if not is_master() and not is_super_admin() then
      raise exception 'Only HQ can approve a job for invoicing (Final Complete)';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_job_invoice_gate on jobs;
create trigger guard_job_invoice_gate
  before update on jobs
  for each row execute function guard_job_invoice_gate();

-- ─────────────────────────────────────────────
-- 3. Fix migration 24's profile guard for service-role callers
--    guard_profile_sensitive_columns() raises for ANY caller that is not
--    a master/super admin — including the service role (auth.uid() is
--    null), which is exactly how admin-lock-user updates profiles.locked.
--    Net effect: locking/unlocking a user from the Team page fails (the
--    auth-layer ban applies, then the profiles.locked mirror write 500s).
--    Re-create the function with the same service-role allowance as above.
--    (The guard_profile_columns trigger from migration 24 stays in place;
--    only the function body changes.)
-- ─────────────────────────────────────────────

create or replace function guard_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Trusted server-side code (service role) — see note in section 2.
  if auth.uid() is null then
    return new;
  end if;

  if (
    new.role is distinct from old.role
    or new.business_id is distinct from old.business_id
    or new.locked is distinct from old.locked
  ) then
    if not is_master() and not is_super_admin() then
      raise exception 'Only administrators can change role, business, or lock status';
    end if;
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- 4. Unique job refs per business
--    genRef() runs client-side (max + 1 over loaded jobs), so two devices
--    creating jobs concurrently could mint the same ref. First de-dupe any
--    existing collisions (suffix -2, -3, …), then add the constraint.
--    The client retries once with a fresh ref on conflict (AppContext).
--    NOTE: if this ALTER fails, a suffixed ref already existed — resolve
--    manually and re-run. The unique index also doubles as a useful
--    (business_id, ref) lookup index.
-- ─────────────────────────────────────────────

with dupes as (
  select id,
         row_number() over (
           partition by business_id, ref
           order by created_at, id
         ) as rn
  from jobs
)
update jobs j
   set ref = j.ref || '-' || d.rn
  from dupes d
 where d.id = j.id
   and d.rn > 1;

alter table jobs drop constraint if exists jobs_business_ref_unique;
alter table jobs add constraint jobs_business_ref_unique unique (business_id, ref);

-- ─────────────────────────────────────────────
-- 5. Allow unscheduled jobs (nullable date)
--    1_schema.sql declares jobs.date NOT NULL, but the app inserts
--    date = null for unscheduled jobs (UnscheduledPanel, rescheduleJob).
--    Live databases may have been altered by hand already — this makes it
--    official so fresh installs work. No-op if already nullable.
-- ─────────────────────────────────────────────

alter table jobs alter column date drop not null;
