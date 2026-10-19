-- Run manually before deploying the Apartment for sale layer.
-- Existing events and imports remain in the default events layer.
BEGIN;

ALTER TABLE social_events
    ADD COLUMN map_layer VARCHAR(10) NOT NULL DEFAULT 'events';
ALTER TABLE social_events
    ADD CONSTRAINT social_events_map_layer CHECK (
        map_layer IN ('events', 'apartments')
        AND (event_type = 'global' OR map_layer = 'events')
    );

COMMIT;
