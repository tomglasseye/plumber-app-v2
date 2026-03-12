-- Add phone number field to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
