-- Apply to existing installations before deploying the profile avatar controls.
ALTER TABLE social_profiles
    ADD COLUMN IF NOT EXISTS avatar_hidden BOOLEAN NOT NULL DEFAULT FALSE;
