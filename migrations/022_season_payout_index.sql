-- Migration 022: Partial index for season payout lookups
-- Speeds up admin payout detail + wallet earnings aggregation queries.

CREATE INDEX IF NOT EXISTS idx_credit_ledger_season_payout
  ON credit_ledger(season_id, tx_type)
  WHERE tx_type = 'season_payout';
