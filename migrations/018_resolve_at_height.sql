-- Migration 018: Add resolve_at_height to season_races (A4-1)
-- Records the Ergo block height used for deterministic RNG during race resolution.
-- Enables auditable, reproducible race results.

ALTER TABLE season_races
  ADD COLUMN IF NOT EXISTS resolve_at_height INTEGER;

COMMENT ON COLUMN season_races.resolve_at_height IS 'Ergo block height used for RNG seed during race resolution';
