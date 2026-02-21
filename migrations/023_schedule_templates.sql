-- Race scheduling system: saved templates + batch-creation tracking
--
-- schedule_templates: Reusable schedule configs for one-click season generation.
-- season_races.scheduled: Track which races were batch-created vs manual.
-- seasons.schedule_template: Optionally attach a template to a season for future cron auto-creation.

-- Saved schedule templates for reuse
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  collection_id UUID REFERENCES collections(id),
  template JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedule_templates_collection ON schedule_templates(collection_id);

-- Optional: attach a template to a season for future cron auto-creation
ALTER TABLE seasons ADD COLUMN schedule_template JSONB;

-- Track which races were batch-created vs manual
ALTER TABLE season_races ADD COLUMN scheduled BOOLEAN NOT NULL DEFAULT false;
