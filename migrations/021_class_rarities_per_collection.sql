-- Migration 021: Per-collection rarity class mapping
-- Moves CLASS_RARITIES from hardcoded constant to game_config_overrides.
-- Each collection defines which of its rarity tiers belong to each class.

-- CyberPets: 9 tiers across 3 classes
UPDATE collections
SET game_config_overrides = COALESCE(game_config_overrides, '{}'::jsonb) || '{
  "class_rarities": {
    "rookie": ["common", "uncommon", "rare"],
    "contender": ["masterwork", "epic", "relic"],
    "champion": ["legendary", "mythic", "cyberium"]
  }
}'::jsonb
WHERE name = 'CyberPets';

-- Aneta Angels: 6 tiers across 3 classes
UPDATE collections
SET game_config_overrides = COALESCE(game_config_overrides, '{}'::jsonb) || '{
  "class_rarities": {
    "rookie": ["common", "uncommon"],
    "contender": ["rare", "epic"],
    "champion": ["legendary", "mythic"]
  }
}'::jsonb
WHERE name = 'Aneta Angels';
