-- =============================================================
-- DPH Plumbing App — Seed Data
-- Run this SECOND in Supabase → SQL Editor → New Query
-- (Run 1_schema.sql first)
--
-- This creates:
--   • 1 business (DPH Plumbing Ltd)
--   • 4 auth users  (dave / tom / sam / lee — all password: Plumber1!)
--   • 4 profiles    (linked to those auth users)
--   • 6 sample jobs
-- =============================================================

-- ─────────────────────────────────────────────
-- Fixed UUIDs — makes the script re-runnable
-- ─────────────────────────────────────────────
-- business : a0000000-0000-0000-0000-000000000001
-- dave     : b0000000-0000-0000-0000-000000000001
-- tom      : b0000000-0000-0000-0000-000000000002
-- sam      : b0000000-0000-0000-0000-000000000003
-- lee      : b0000000-0000-0000-0000-000000000004

-- ─────────────────────────────────────────────
-- 1. BUSINESS
-- ─────────────────────────────────────────────
insert into businesses (id, name, phone, email, address, vat_number, accent_color, logo_initials)
values (
  'a0000000-0000-0000-0000-000000000001',
  'DPH Plumbing Ltd',
  '01202 555 123',
  'office@dphplumbing.co.uk',
  'Unit 4, Harbour Trade Park, Poole BH15 1TT',
  'GB 123 4567 89',
  '#f97316',
  'DPH'
)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- 2. AUTH USERS
-- ─────────────────────────────────────────────
-- Users must already exist in Supabase Auth before running this script.
-- Create them via: Supabase Dashboard → Authentication → Users → Add User
--   dave@dphplumbing.co.uk  /  Plumber1!  (role: master)
--   tom@dphplumbing.co.uk   /  Plumber1!
--   sam@dphplumbing.co.uk   /  Plumber1!
--   lee@dphplumbing.co.uk   /  Plumber1!
--
-- The profiles below look up the real UUIDs by email automatically.

-- ─────────────────────────────────────────────
-- 3. PROFILES (look up real auth UUIDs by email)
-- ─────────────────────────────────────────────
insert into profiles (id, business_id, name, phone, role, avatar, home_address)
values
  (
    (select id from auth.users where email = 'dave@dphplumbing.co.uk'),
    'a0000000-0000-0000-0000-000000000001',
    'Dave Harris', '07700 900001',
    'master', 'DH', '22 Harbour View, Poole BH15 1NN'
  ),
  (
    (select id from auth.users where email = 'tom@dphplumbing.co.uk'),
    'a0000000-0000-0000-0000-000000000001',
    'Tom Briggs', '07700 900002',
    'engineer', 'TB', '5 Sandbanks Rd, Poole BH14 8BU'
  ),
  (
    (select id from auth.users where email = 'sam@dphplumbing.co.uk'),
    'a0000000-0000-0000-0000-000000000001',
    'Sam Carter', '07700 900003',
    'engineer', 'SC', '17 Stour Rd, Christchurch BH23 1PL'
  ),
  (
    (select id from auth.users where email = 'lee@dphplumbing.co.uk'),
    'a0000000-0000-0000-0000-000000000001',
    'Lee Owens', '07700 900004',
    'engineer', 'LO', '8 Ringwood Rd, Bournemouth BH11 8LP'
  )
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- 4. JOBS (look up assigned_to via profiles.email)
-- ─────────────────────────────────────────────
insert into jobs (
  id, business_id, ref, customer, address, type, description,
  assigned_to, status, priority, date,
  materials, notes, time_spent, ready_to_invoice
)
values
  (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'DPH-001', 'Mr & Mrs Patel', '14 Orchard Lane, Poole BH15 1AB',
    'Boiler Service', 'Annual boiler service and safety check.',
    (select id from auth.users where email = 'tom@dphplumbing.co.uk'),
    'Completed', 'Normal', '2026-03-08',
    'Boiler filter x1, gasket set', 'Service completed.', 2.5, false
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'DPH-002', 'Riverside Cafe', '2 Quay Rd, Poole BH15 4AB',
    'Emergency Leak', 'Burst pipe under kitchen sink, water damage to unit.',
    (select id from auth.users where email = 'sam@dphplumbing.co.uk'),
    'On Site', 'Emergency', '2026-03-09',
    '', '', 0, false
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'DPH-003', 'Mrs J Thompson', '88 Canford Rd, Wimborne BH21 2EE',
    'Bathroom Fit', 'Full bathroom refit - new suite, tiling, thermostatic shower.',
    (select id from auth.users where email = 'tom@dphplumbing.co.uk'),
    'Scheduled', 'Normal', '2026-03-09',
    '', '', 0, false
  ),
  (
    'c0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'DPH-004', 'Parkside Apartments', 'Unit 6, Parkside, Bournemouth BH8 1AA',
    'Radiator Replacement', 'Replace 3 radiators in lounge and bedrooms.',
    (select id from auth.users where email = 'lee@dphplumbing.co.uk'),
    'En Route', 'High', '2026-03-09',
    '', '', 0, false
  ),
  (
    'c0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000001',
    'DPH-005', 'Mr Blake', '31 Pine Ave, Ferndown BH22 9XT',
    'Boiler Repair', 'No hot water - likely diverter valve fault.',
    (select id from auth.users where email = 'sam@dphplumbing.co.uk'),
    'Scheduled', 'High', '2026-03-09',
    '', '', 0, false
  ),
  (
    'c0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000001',
    'DPH-006', 'Mrs Holloway', '4 Victoria Rd, Bournemouth BH1 4QR',
    'Boiler Service', 'Annual boiler service.',
    (select id from auth.users where email = 'tom@dphplumbing.co.uk'),
    'Scheduled', 'Low', '2026-03-09',
    '', '', 0, false
  )
on conflict (id) do nothing;
