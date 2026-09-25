ALTER TABLE infographics
    ADD COLUMN IF NOT EXISTS distillery_id INTEGER REFERENCES distilleries(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_infographics_distillery_id_unique
    ON infographics (distillery_id);
