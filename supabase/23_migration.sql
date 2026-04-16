-- =============================================================
-- Migration 23: Tighten job-photos Storage bucket policies
-- The original policies (migration 19) only checked auth.uid() IS NOT NULL,
-- meaning any authenticated user could read/write any business's photos
-- if they knew the storage path. These replacements scope access to photos
-- belonging to jobs in the user's own business.
-- Run in Supabase → SQL Editor → New Query
-- =============================================================

-- Drop the overly-broad originals
DROP POLICY IF EXISTS "members upload job photos" ON storage.objects;
DROP POLICY IF EXISTS "members read job photos" ON storage.objects;
DROP POLICY IF EXISTS "members delete own job photos" ON storage.objects;

-- READ: user can only read photos for jobs in their business
CREATE POLICY "members read job photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'job-photos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM job_photos jp
        JOIN jobs j ON j.id = jp.job_id
      WHERE jp.storage_path = name
        AND j.business_id = my_business_id()
    )
  );

-- INSERT: user can upload, but only to paths that will be linked to their business's jobs.
-- At upload time the job_photos row doesn't exist yet, so we check that the
-- first path segment (the jobId) belongs to a job in their business.
CREATE POLICY "members upload job photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'job-photos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE id::text = split_part(name, '/', 1)
        AND business_id = my_business_id()
    )
  );

-- DELETE: user can only delete photos for jobs in their business
CREATE POLICY "members delete job photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'job-photos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM job_photos jp
        JOIN jobs j ON j.id = jp.job_id
      WHERE jp.storage_path = name
        AND j.business_id = my_business_id()
    )
  );
