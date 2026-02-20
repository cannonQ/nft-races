-- Migration 020: Token fee support (dual-currency with Babel boxes)
-- Depends on: 019_audit_b_fixes.sql

-- 1. Race entry fee in collection's token (nullable — null means ERG only)
ALTER TABLE season_races ADD COLUMN entry_fee_token BIGINT DEFAULT NULL;

-- 2. Credit ledger — track which currency was used
ALTER TABLE credit_ledger ADD COLUMN fee_token_id TEXT DEFAULT NULL;
ALTER TABLE credit_ledger ADD COLUMN fee_token_amount BIGINT DEFAULT NULL;

-- 3. ErgoPay TX requests — track payment currency
ALTER TABLE ergopay_tx_requests ADD COLUMN payment_currency TEXT NOT NULL DEFAULT 'erg';

ALTER TABLE ergopay_tx_requests
  DROP CONSTRAINT IF EXISTS ergopay_tx_requests_payment_currency_check;
ALTER TABLE ergopay_tx_requests
  ADD CONSTRAINT ergopay_tx_requests_payment_currency_check
  CHECK (payment_currency IN ('erg', 'token'));
