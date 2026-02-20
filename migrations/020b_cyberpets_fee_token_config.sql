-- Migration 020b: Set CyberPets collection fee token config
-- Run AFTER 020_token_fee_support.sql
-- This sets the CYPX token as the fee currency for CyberPets collection.
-- Aneta Angels stays ERG-only (no fee_token in overrides).
--
-- Reference rate: 0.05 ERG = 187 CYPX (3,740 CYPX/ERG). Admin-set per season, no oracle.

UPDATE collections
SET game_config_overrides = COALESCE(game_config_overrides, '{}'::jsonb) || '{
  "fee_token": {
    "token_id": "01dce8a5632d19799950ff90bca3b5d0ca3ebfa8aaafd06f0cc6dd1e97150e7f",
    "name": "CYPX",
    "decimals": 4,
    "training_fee": 37,
    "default_race_entry_fee": 187,
    "treatment_fees": {
      "stim_pack": 19,
      "cryo_pod": 37,
      "full_reset": 75
    }
  },
  "babel": {
    "enabled": true
  }
}'::jsonb
WHERE name = 'CyberPets';
