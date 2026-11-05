CREATE TABLE IF NOT EXISTS presentation_broadcast (
    id VARCHAR(6) PRIMARY KEY,
    room_id VARCHAR(32) REFERENCES presentation_rooms(id) ON DELETE SET NULL
);
