-- =============================================================
-- Migration 19: Materials cost + Job photos infrastructure
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

-- ── Materials cost on jobs ──────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_cost numeric(8,2) DEFAULT 0;

-- ── Job photos storage policies ─────────────────────────────
-- NOTE: Create the 'job-photos' bucket manually in Supabase Dashboard → Storage → New bucket (private)

CREATE POLICY "members upload job photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "members read job photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "members delete own job photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

-- ── Enforce 2-photo limit per job (server-side) ─────────────
CREATE OR REPLACE FUNCTION check_job_photo_limit()
RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM job_photos WHERE job_id = NEW.job_id) >= 2 THEN
    RAISE EXCEPTION 'Maximum 2 photos per job';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_job_photo_limit
  BEFORE INSERT ON job_photos
  FOR EACH ROW EXECUTE FUNCTION check_job_photo_limit();
