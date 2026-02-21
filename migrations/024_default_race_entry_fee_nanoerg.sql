-- Migration 024: Add default_race_entry_fee_nanoerg to game_config_overrides
-- Fixes bug: race creation was querying non-existent collections.entry_fee_nanoerg column,
-- causing all races to be created with entry_fee_nanoerg = 0 (free ERG entry).
--
-- CyberPets: 0.05 ERG = 50,000,000 nanoERG (matches 187 CYPX reference rate)
-- Aneta Angels: 0.05 ERG = 50,000,000 nanoERG (ERG-only, no token fee)

UPDATE collections
SET game_config_overrides = COALESCE(game_config_overrides, '{}'::jsonb) || '{
  "default_race_entry_fee_nanoerg": 50000000
}'::jsonb
WHERE name = 'CyberPets';

UPDATE collections
SET game_config_overrides = COALESCE(game_config_overrides, '{}'::jsonb) || '{
  "default_race_entry_fee_nanoerg": 50000000
}'::jsonb
WHERE name = 'Aneta Angels';

-- Fix existing live races that were created with 0 ERG fee
UPDATE season_races
SET entry_fee_nanoerg = 50000000
WHERE entry_fee_nanoerg = 0
  AND status = 'open';
