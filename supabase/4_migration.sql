-- Add sort_order column to jobs for master-controlled daily scheduling order
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
