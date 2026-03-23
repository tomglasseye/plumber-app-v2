-- =============================================================
-- Migration 15: Profile DELETE policy + CHECK constraints
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

-- 1. Allow masters to delete team profiles within their own business.
--    The id != auth.uid() guard prevents a master from accidentally
--    deleting their own account and locking out the business.
create policy "masters can delete team profiles"
  on profiles for delete
  using (
    id != auth.uid()
    and business_id = my_business_id()
    and is_master()
  );

-- 2. CHECK constraints on key text fields.
--    These apply to new rows immediately; existing data is not re-validated
--    (use NOT VALID + VALIDATE CONSTRAINT later if strict enforcement needed).

-- businesses
alter table businesses
  add constraint businesses_name_length
    check (length(trim(name)) >= 1 and length(name) <= 200) not valid;

-- profiles
alter table profiles
  add constraint profiles_name_length
    check (length(trim(name)) >= 1 and length(name) <= 100) not valid;

-- jobs
alter table jobs
  add constraint jobs_customer_length
    check (length(trim(customer)) >= 1 and length(customer) <= 200) not valid,
  add constraint jobs_address_length
    check (length(trim(address)) >= 1 and length(address) <= 500) not valid,
  add constraint jobs_description_length
    check (length(description) <= 5000) not valid,
  add constraint jobs_notes_length
    check (length(notes) <= 10000) not valid,
  add constraint jobs_materials_length
    check (length(materials) <= 5000) not valid;

-- customers
alter table customers
  add constraint customers_name_length
    check (length(trim(name)) >= 1 and length(name) <= 200) not valid,
  add constraint customers_address_length
    check (length(address) <= 500) not valid,
  add constraint customers_notes_length
    check (length(notes) <= 2000) not valid;
