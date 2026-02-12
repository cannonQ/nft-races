-- Migration 008: ErgoPay session storage
-- Short-lived sessions for the ErgoPay mobile wallet address-prompt flow.
-- Address starts NULL, gets populated when the mobile wallet calls back.
-- Sessions expire after 5 minutes.

CREATE TABLE ergopay_sessions (
  id         TEXT PRIMARY KEY,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE INDEX idx_ergopay_sessions_expires ON ergopay_sessions(expires_at);
