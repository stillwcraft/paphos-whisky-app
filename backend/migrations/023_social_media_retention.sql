-- Apply before enabling the social cleanup cron job.
-- Existing uploads receive the migration time, giving them a 24-hour grace period.
ALTER TABLE social_media
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS ix_social_media_created_at ON social_media(created_at);
