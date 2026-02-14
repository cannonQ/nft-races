-- Migration 011: Add Aneta Angels collection
-- Prerequisites: 010_game_config_overrides.sql (for game_config_overrides column)

-- Insert Aneta Angels collection row
-- base_stat_template: 6 tiers (Common-Mythic) with total_base stat budgets
-- trait_mapping: Wings→SPD, Body→STM, Face→HRT, Head→ACC, Background→AGI, Skin Tone→Focus
-- game_config_overrides: empty (uses global defaults, tune later)

-- Guard: only insert if not already present
INSERT INTO collections (name, base_stat_template, trait_mapping, game_config_overrides)
SELECT
  'Aneta Angels',
  '{
    "Common":    { "total_base": 50, "floor": 2 },
    "Uncommon":  { "total_base": 60, "floor": 2 },
    "Rare":      { "total_base": 70, "floor": 2 },
    "Epic":      { "total_base": 80, "floor": 2 },
    "Legendary": { "total_base": 90, "floor": 2 },
    "Mythic":    { "total_base": 100, "floor": 2 }
  }'::jsonb,
  '{
    "stat_map": {
      "Wings": "speed",
      "Body": "stamina",
      "Face": "heart",
      "Head": "accel",
      "Background": "agility"
    },
    "focus_map": {
      "Tone 1": 40,
      "Tone 2": 25,
      "Tone 3": 15,
      "Tone 4": 5
    },
    "floor": 2
  }'::jsonb,
  '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM collections WHERE name = 'Aneta Angels'
);
