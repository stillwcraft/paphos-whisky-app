-- Apply to existing PostgreSQL installations before deploying global social events.
ALTER TABLE social_events ALTER COLUMN description TYPE VARCHAR(5000);
ALTER TABLE social_events ALTER COLUMN photo_key DROP NOT NULL;
ALTER TABLE social_events
    ADD COLUMN event_type VARCHAR(10) NOT NULL DEFAULT 'regular',
    ADD COLUMN image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE social_events
    ADD CONSTRAINT social_events_event_type CHECK (event_type IN ('regular', 'global')),
    ADD CONSTRAINT social_events_regular_photo CHECK (event_type = 'global' OR photo_key IS NOT NULL);
