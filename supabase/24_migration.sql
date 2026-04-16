-- =============================================================
-- Migration 24: Security hardening
-- 1. Prevent privilege escalation on profile self-update
-- 2. Validate audit log action names to prevent junk entries
-- Run in Supabase → SQL Editor → New Query
-- =============================================================


-- ── 1. Guard sensitive profile columns ──────────────────────
-- The "users update own profile" RLS policy allows engineers to
-- update their own row, but doesn't restrict columns. An engineer
-- could set role='master', locked=false, or change business_id
-- via a direct Supabase API call.
--
-- Fix: a BEFORE UPDATE trigger that rejects changes to sensitive
-- columns unless the caller is a master or super admin.

CREATE OR REPLACE FUNCTION guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.business_id IS DISTINCT FROM OLD.business_id
    OR NEW.locked IS DISTINCT FROM OLD.locked
  ) THEN
    IF NOT is_master() AND NOT is_super_admin() THEN
      RAISE EXCEPTION 'Only administrators can change role, business, or lock status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_columns ON profiles;
CREATE TRIGGER guard_profile_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_profile_sensitive_columns();


-- ── 2. Validate audit log actions ───────────────────────────
-- Replace the original log_audit_event function with one that
-- rejects unknown action names and restricts admin-only actions
-- to masters.

CREATE OR REPLACE FUNCTION log_audit_event(
  p_action      text,
  p_target_type text default null,
  p_target_id   text default null,
  p_details     jsonb default null
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_allowed_actions text[] := ARRAY[
    'job.created', 'job.status_changed', 'job.priority_changed',
    'job.field_updated', 'job.rescheduled', 'job.final_completed',
    'business.settings_updated',
    'profile.locked', 'profile.unlocked', 'profile.deleted',
    'auth.password_change_self', 'auth.password_changed_by_master'
  ];
  v_master_only_actions text[] := ARRAY[
    'business.settings_updated',
    'profile.locked', 'profile.unlocked', 'profile.deleted',
    'auth.password_changed_by_master'
  ];
BEGIN
  -- Reject unknown actions
  IF NOT (p_action = ANY(v_allowed_actions)) THEN
    RAISE EXCEPTION 'Unknown audit action: %', p_action;
  END IF;

  -- Admin-only actions require master or super admin
  IF p_action = ANY(v_master_only_actions) THEN
    IF NOT is_master() AND NOT is_super_admin() THEN
      RAISE EXCEPTION 'Action % requires administrator privileges', p_action;
    END IF;
  END IF;

  INSERT INTO audit_log (business_id, actor_id, action, target_type, target_id, details)
  SELECT
    (SELECT business_id FROM profiles WHERE id = auth.uid()),
    auth.uid(),
    p_action,
    p_target_type,
    p_target_id,
    p_details;
END;
$$;
