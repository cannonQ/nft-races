-- Migration 015: Treatment Center
--
-- Phase 3 of fatigue/sharpness rework. Lockout-based deep recovery:
-- Stim Pack (6h, -20 fatigue), Cryo Pod (12h, -40 fatigue, sharpness→50),
-- Full Reset (24h, fatigue→0, sharpness→30).

-- Treatment state on creature_stats
ALTER TABLE creature_stats
  ADD COLUMN treatment_type TEXT,
  ADD COLUMN treatment_started_at TIMESTAMPTZ,
  ADD COLUMN treatment_ends_at TIMESTAMPTZ;

-- Treatment history
CREATE TABLE treatment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creature_id UUID NOT NULL REFERENCES creatures(id),
  season_id UUID NOT NULL REFERENCES seasons(id),
  owner_address TEXT NOT NULL,
  treatment_type TEXT NOT NULL,
  duration_hours INT NOT NULL,
  fatigue_before NUMERIC(5,2),
  fatigue_after NUMERIC(5,2),
  sharpness_before NUMERIC(5,2),
  sharpness_after NUMERIC(5,2),
  cost_nanoerg BIGINT NOT NULL DEFAULT 0,
  tx_id TEXT,
  shadow BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by creature + season
CREATE INDEX idx_treatment_log_creature_season ON treatment_log(creature_id, season_id);

-- Treatment tiers in game_config
UPDATE game_config
SET config = jsonb_set(config, '{treatments}', '{
  "stim_pack": {
    "name": "Stim Pack",
    "duration_hours": 6,
    "fatigue_reduction": 20,
    "sharpness_set": null,
    "cost_nanoerg": 5000000
  },
  "cryo_pod": {
    "name": "Cryo Pod",
    "duration_hours": 12,
    "fatigue_reduction": 40,
    "sharpness_set": 50,
    "cost_nanoerg": 10000000
  },
  "full_reset": {
    "name": "Full Reset",
    "duration_hours": 24,
    "fatigue_reduction": null,
    "sharpness_set": 30,
    "cost_nanoerg": 20000000
  }
}'::jsonb)
WHERE id = 1;
