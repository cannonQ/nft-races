-- Migration 012: ErgoPay transaction request tracking
-- Tracks payment requests created via ergopay.duckdns.org for mobile wallet users.
-- The backend creates a request, polls for completion, then executes the game action.

CREATE TABLE ergopay_tx_requests (
  id              TEXT PRIMARY KEY,
  wallet_address  TEXT NOT NULL,
  action_type     TEXT NOT NULL CHECK (action_type IN ('training_fee', 'race_entry_fee')),
  amount_nanoerg  BIGINT NOT NULL,
  creature_id     UUID REFERENCES creatures(id),
  race_id         UUID REFERENCES season_races(id),
  action_payload  JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'executing', 'executed', 'expired', 'failed')),
  signed_tx_id    TEXT,
  result_payload  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes')
);

CREATE INDEX idx_ergopay_tx_status ON ergopay_tx_requests(status) WHERE status = 'pending';

-- Add tx_id column to credit_ledger for linking real on-chain transactions
ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS tx_id TEXT;
