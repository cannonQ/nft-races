-- Migration 007: Shadow billing credit ledger
-- Tracks all theoretical debits and credits per wallet address in nanoERG.
-- Phase 1: "shadow" mode — entries are logged but don't gate any actions.
-- Phase 2: entries will correspond to real on-chain ERG transactions.

CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN (
    'training_fee',
    'race_entry_fee',
    'race_payout',
    'season_payout',
    'deposit',
    'withdrawal',
    'admin_credit'
  )),
  amount_nanoerg BIGINT NOT NULL,          -- positive = credit, negative = debit
  balance_after_nanoerg BIGINT,            -- running balance snapshot (computed at insert time)
  creature_id UUID REFERENCES creatures(id),
  race_id UUID REFERENCES season_races(id),
  season_id UUID REFERENCES seasons(id),
  training_log_id UUID REFERENCES training_log(id),
  race_entry_id UUID,
  memo TEXT,
  shadow BOOLEAN NOT NULL DEFAULT true,    -- true = no real ERG moved
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast wallet balance + history lookups
CREATE INDEX idx_credit_ledger_wallet ON credit_ledger (owner_address, created_at DESC);

-- Find ledger entries for a specific race
CREATE INDEX idx_credit_ledger_race ON credit_ledger (race_id) WHERE race_id IS NOT NULL;

-- Find ledger entries for a specific creature
CREATE INDEX idx_credit_ledger_creature ON credit_ledger (creature_id) WHERE creature_id IS NOT NULL;
