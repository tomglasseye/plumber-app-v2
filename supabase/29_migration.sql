-- =============================================================
-- Migration 29: Per-business Web Push opt-in flag
-- Run in Supabase → SQL Editor → New Query (after migration 28)
-- =============================================================

-- ─────────────────────────────────────────────
-- Web Push opt-in, per business.
--
-- Web Push (native OS notifications) is OFF by default. In-app notifications
-- (Supabase Realtime → notification bell + on-screen banner) are unaffected by
-- this flag and always run. When false (the default), the client never calls
-- subscribeToPush(), so engineers/masters are not prompted for OS notification
-- permission on login.
--
-- A business master opts in from Account → Business settings. See
-- docs/NOTIFICATIONS.md (the actual push *send* path — firePush — is a later
-- phase; this flag gates the subscription/permission prompt today).
-- ─────────────────────────────────────────────
alter table businesses
  add column if not exists push_enabled boolean not null default false;
