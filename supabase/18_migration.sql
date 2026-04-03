-- Enable Supabase Realtime for jobs and team_holidays tables
-- Run this in the Supabase SQL Editor before deploying the client code changes.

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE team_holidays;

-- Full replica identity so UPDATE payloads include the complete row
-- (default only includes the primary key in the old record)
ALTER TABLE jobs REPLICA IDENTITY FULL;
ALTER TABLE team_holidays REPLICA IDENTITY FULL;
