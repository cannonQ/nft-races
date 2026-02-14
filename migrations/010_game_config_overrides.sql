-- Migration 010: Per-collection game config overrides
-- Allows each collection to override global game_config values
-- (training gains, cooldown, actions/day, boost rewards, etc.)

ALTER TABLE collections ADD COLUMN IF NOT EXISTS game_config_overrides JSONB DEFAULT '{}';

COMMENT ON COLUMN collections.game_config_overrides IS
  'Per-collection overrides for game_config values. Deep-merged with global config at runtime. Example: {"base_actions": 3, "cooldown_hours": 4}';
