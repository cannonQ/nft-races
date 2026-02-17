-- Migration 017: Add 'treatment_fee' to ergopay_tx_requests action_type CHECK constraint
-- The treatment center (migration 015) added a new action type but the CHECK constraint
-- on ergopay_tx_requests (migration 012) was not updated, causing ErgoPay treatment
-- requests to fail with a 500 error.

ALTER TABLE ergopay_tx_requests
  DROP CONSTRAINT ergopay_tx_requests_action_type_check;

ALTER TABLE ergopay_tx_requests
  ADD CONSTRAINT ergopay_tx_requests_action_type_check
  CHECK (action_type IN ('training_fee', 'race_entry_fee', 'treatment_fee'));
