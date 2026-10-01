-- Apply to existing PostgreSQL installations before deploying the social router.
-- A fresh installation is also supported by SQLAlchemy Base.metadata.create_all.
CREATE TABLE IF NOT EXISTS social_profiles (
    telegram_id BIGINT PRIMARY KEY, display_name VARCHAR(100) NOT NULL,
    age INTEGER, verified BOOLEAN NOT NULL DEFAULT FALSE, avatar_key VARCHAR(256)
);
CREATE TABLE IF NOT EXISTS social_media (
    key VARCHAR(256) PRIMARY KEY, owner_id BIGINT NOT NULL, kind VARCHAR(10) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_social_media_owner_id ON social_media(owner_id);
CREATE TABLE IF NOT EXISTS social_friend_requests (
    id SERIAL PRIMARY KEY, sender_id BIGINT NOT NULL, recipient_id BIGINT NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'pending', UNIQUE(sender_id, recipient_id)
);
CREATE INDEX IF NOT EXISTS ix_social_friend_requests_sender_id ON social_friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS ix_social_friend_requests_recipient_id ON social_friend_requests(recipient_id);
CREATE TABLE IF NOT EXISTS social_blocks (
    id SERIAL PRIMARY KEY, blocker_id BIGINT NOT NULL, blocked_id BIGINT NOT NULL,
    UNIQUE(blocker_id, blocked_id)
);
-- Supports installations that applied an earlier 022 with the pair as primary key.
ALTER TABLE social_blocks ADD COLUMN IF NOT EXISTS id SERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_social_blocks_id_unique ON social_blocks(id);
CREATE INDEX IF NOT EXISTS ix_social_blocks_blocker_id ON social_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS ix_social_blocks_blocked_id ON social_blocks(blocked_id);
CREATE TABLE IF NOT EXISTS social_events (
    id SERIAL PRIMARY KEY, owner_id BIGINT NOT NULL, description VARCHAR(400) NOT NULL,
    drink VARCHAR(12) NOT NULL, visibility VARCHAR(12) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
    location VARCHAR(150) NOT NULL, photo_key VARCHAR(256) NOT NULL UNIQUE,
    starts_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
    capacity INTEGER, hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT social_events_capacity CHECK (capacity BETWEEN 2 AND 100),
    CONSTRAINT social_events_drink CHECK (drink IN ('beer','wine','spirits','cocktails','coffee')),
    CONSTRAINT social_events_visibility CHECK (visibility IN ('public','friends','anonymous'))
);
CREATE INDEX IF NOT EXISTS ix_social_events_owner_id ON social_events(owner_id);
CREATE INDEX IF NOT EXISTS ix_social_events_expires_at ON social_events(expires_at);
ALTER TABLE social_events ALTER COLUMN capacity DROP NOT NULL;
ALTER TABLE social_events ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS social_tags (
    event_id INTEGER NOT NULL REFERENCES social_events(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL, status VARCHAR(10) NOT NULL DEFAULT 'pending',
    PRIMARY KEY(event_id, telegram_id)
);
-- Previously persisted tags require consent as well; do not grandfather them in.
ALTER TABLE social_tags ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS ix_social_tags_telegram_status ON social_tags(telegram_id, status);
CREATE TABLE IF NOT EXISTS social_cheers (
    event_id INTEGER NOT NULL REFERENCES social_events(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL, PRIMARY KEY(event_id, telegram_id)
);
CREATE TABLE IF NOT EXISTS social_join_requests (
    id SERIAL PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES social_events(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'pending',
    UNIQUE(event_id, telegram_id)
);
CREATE INDEX IF NOT EXISTS ix_social_join_requests_event_id ON social_join_requests(event_id);
CREATE TABLE IF NOT EXISTS social_chat_messages (
    id SERIAL PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES social_events(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL, body VARCHAR(1000) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_social_chat_messages_event_id ON social_chat_messages(event_id);
CREATE TABLE IF NOT EXISTS social_reports (
    id SERIAL PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES social_events(id) ON DELETE CASCADE,
    reporter_id BIGINT NOT NULL, category VARCHAR(20) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'open', resolved_at TIMESTAMPTZ,
    resolved_by BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS ix_social_reports_event_id ON social_reports(event_id);
ALTER TABLE social_reports ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'open';
ALTER TABLE social_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE social_reports ADD COLUMN IF NOT EXISTS resolved_by BIGINT;
