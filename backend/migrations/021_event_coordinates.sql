-- Apply to Supabase before deploying a backend that reads event coordinates.
ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude double precision;
