-- Migration 006: Discrete boost rewards (UTXO-style)
-- Each race reward is a separate row that can be selectively consumed at training time.
-- Boosts expire after 2160 Ergo blocks (~3 days at 720 blocks/day).
-- Players choose which boosts to spend, mirroring how on-chain reward boxes will work in Phase 2.

CREATE TABLE boost_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creature_id UUID NOT NULL REFERENCES creatures(id),
  season_id UUID NOT NULL REFERENCES seasons(id),
  race_id UUID REFERENCES season_races(id),
  multiplier NUMERIC(3,2) NOT NULL,           -- 0.10, 0.25, 0.50
  awarded_at_height INT NOT NULL,             -- Ergo block height when awarded
  expires_at_height INT NOT NULL,             -- awarded_at_height + 2160
  spent_at TIMESTAMPTZ DEFAULT NULL,          -- null = available, set when consumed
  spent_in_training_log_id UUID REFERENCES training_log(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup: available boosts for a creature in a season
CREATE INDEX idx_boost_rewards_available
  ON boost_rewards (creature_id, season_id)
  WHERE spent_at IS NULL;
