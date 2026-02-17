-- Migration 019: Audit B-section fixes
-- B3-1: Composite indexes for frequent query patterns
-- B4-2: Race capacity enforcement trigger
-- B4-3/B3-2: Leaderboard atomic upsert function
-- B1-3: Ownership verification staleness column

-- ============================================================
-- B1-3: Add ownership_verified_at to creatures
-- ============================================================

ALTER TABLE creatures
  ADD COLUMN IF NOT EXISTS ownership_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN creatures.ownership_verified_at
  IS 'Last time on-chain ownership was positively verified via Explorer API';

-- ============================================================
-- B3-1: Composite indexes for frequently queried patterns
-- ============================================================

-- Training action count per creature per day (validateTrainingAction)
CREATE INDEX IF NOT EXISTS idx_training_log_creature_season_bonus
  ON training_log(creature_id, season_id, bonus_action, created_at DESC);

-- Race entry duplicate check + count (executeRaceEntry)
CREATE INDEX IF NOT EXISTS idx_race_entries_race_creature
  ON season_race_entries(race_id, creature_id);

-- Unspent boost lookup (training with boosts)
CREATE INDEX IF NOT EXISTS idx_boost_rewards_creature_unspent
  ON boost_rewards(creature_id) WHERE spent_at IS NULL;

-- Wallet balance / ledger history
CREATE INDEX IF NOT EXISTS idx_credit_ledger_owner_created
  ON credit_ledger(owner_address, created_at DESC);

-- Leaderboard lookup during race resolution
CREATE INDEX IF NOT EXISTS idx_leaderboard_season_creature
  ON season_leaderboard(season_id, creature_id);

-- Unconsumed recovery packs
CREATE INDEX IF NOT EXISTS idx_recovery_rewards_creature_unconsumed
  ON recovery_rewards(creature_id) WHERE consumed_at IS NULL;

-- TX dedup index (verify-tx.ts isTxIdUsed)
CREATE INDEX IF NOT EXISTS idx_credit_ledger_txid_nonshadow
  ON credit_ledger(tx_id) WHERE shadow = false AND tx_id IS NOT NULL;

-- ============================================================
-- B4-2: Race capacity enforcement trigger
-- Prevents TOCTOU race on entry count check → insert
-- ============================================================

CREATE OR REPLACE FUNCTION check_race_capacity()
RETURNS trigger AS $$
DECLARE
  current_count INTEGER;
  max_cap INTEGER;
BEGIN
  -- Count existing entries (excluding the one being inserted)
  SELECT count(*) INTO current_count
    FROM season_race_entries
    WHERE race_id = NEW.race_id;

  SELECT max_entries INTO max_cap
    FROM season_races
    WHERE id = NEW.race_id;

  IF max_cap IS NOT NULL AND current_count >= max_cap THEN
    RAISE EXCEPTION 'Race is full (% of % entries)', current_count, max_cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_race_capacity ON season_race_entries;
CREATE TRIGGER trg_check_race_capacity
  BEFORE INSERT ON season_race_entries
  FOR EACH ROW
  EXECUTE FUNCTION check_race_capacity();

-- ============================================================
-- B4-3 / B3-2: Leaderboard atomic upsert
-- Eliminates read-then-write race condition and N+1 queries
-- ============================================================

-- Need unique constraint for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_leaderboard_season_creature'
  ) THEN
    ALTER TABLE season_leaderboard
      ADD CONSTRAINT uq_leaderboard_season_creature
      UNIQUE (season_id, creature_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION upsert_leaderboard_entry(
  p_season_id UUID,
  p_creature_id UUID,
  p_owner_address TEXT,
  p_position INTEGER,
  p_payout_nanoerg BIGINT,
  p_league_points NUMERIC
) RETURNS void AS $$
  INSERT INTO season_leaderboard (
    season_id, creature_id, owner_address,
    wins, places, shows, races_entered,
    total_earnings_nanoerg, league_points
  ) VALUES (
    p_season_id, p_creature_id, p_owner_address,
    CASE WHEN p_position = 1 THEN 1 ELSE 0 END,
    CASE WHEN p_position = 2 THEN 1 ELSE 0 END,
    CASE WHEN p_position = 3 THEN 1 ELSE 0 END,
    1,
    p_payout_nanoerg,
    p_league_points
  )
  ON CONFLICT (season_id, creature_id) DO UPDATE SET
    wins = season_leaderboard.wins + EXCLUDED.wins,
    places = season_leaderboard.places + EXCLUDED.places,
    shows = season_leaderboard.shows + EXCLUDED.shows,
    races_entered = season_leaderboard.races_entered + 1,
    total_earnings_nanoerg = season_leaderboard.total_earnings_nanoerg + EXCLUDED.total_earnings_nanoerg,
    league_points = ROUND((season_leaderboard.league_points + EXCLUDED.league_points)::numeric, 2);
$$ LANGUAGE sql;

-- ============================================================
-- B3-3: Wallet balance via SUM (race-condition-safe)
-- ============================================================

CREATE OR REPLACE FUNCTION get_wallet_balance(p_owner_address TEXT)
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(amount_nanoerg), 0)::BIGINT
    FROM credit_ledger
    WHERE owner_address = p_owner_address;
$$ LANGUAGE sql STABLE;
