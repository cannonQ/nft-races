-- Migration 009: Wallet display names (cosmetic, off-chain only)
-- Purely off-chain profiles. Smart contracts never reference this table.
-- The off-chain indexer can LEFT JOIN this table to enrich API responses.

CREATE TABLE wallet_profiles (
  address       TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness: prevent "Andrius" and "andrius" from coexisting
CREATE UNIQUE INDEX idx_wallet_profiles_display_name_lower
  ON wallet_profiles (LOWER(display_name));
