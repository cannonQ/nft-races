-- Migration 016: Rarity Class Races
-- Adds rarity_class and class_weight columns to season_races,
-- league_points column to season_leaderboard,
-- and recovery_rewards table for UTXO-style fatigue recovery from class races.

-- 1. Add rarity class restriction to races (NULL = open / any rarity)
ALTER TABLE season_races
  ADD COLUMN rarity_class TEXT;

-- 2. Class weight for fractional leaderboard points (1.0 = full, 0.14 = 1/7)
ALTER TABLE season_races
  ADD COLUMN class_weight NUMERIC(4,2) NOT NULL DEFAULT 1.0;

-- 3. League points on season_leaderboard (primary sort for rankings)
ALTER TABLE season_leaderboard
  ADD COLUMN league_points NUMERIC(6,2) NOT NULL DEFAULT 0;

-- 4. Recovery rewards table (UTXO-style, consumed at training time)
CREATE TABLE recovery_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creature_id UUID NOT NULL REFERENCES creatures(id),
  season_id UUID NOT NULL REFERENCES seasons(id),
  race_id UUID NOT NULL REFERENCES season_races(id),
  fatigue_reduction NUMERIC(5,2) NOT NULL,  -- e.g. -8, -5, -4, -3
  awarded_at_height INT NOT NULL,
  expires_at_height INT NOT NULL,  -- awarded_at_height + expiry blocks (~3 days)
  consumed_at TIMESTAMPTZ,
  consumed_in_training_log_id UUID REFERENCES training_log(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup of available recovery packs per creature
CREATE INDEX idx_recovery_rewards_creature
  ON recovery_rewards(creature_id)
  WHERE consumed_at IS NULL;
