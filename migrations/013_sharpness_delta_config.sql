-- Migration 013: Add sharpness_delta to activity definitions in game_config
--
-- Phase 1 of fatigue/sharpness rework. Physical activities cost sharpness,
-- mental activities build it. Also adds new decay/modifier config params.
--
-- This updates the JSON blob in game_config.config — no schema changes.

-- Add sharpness_delta to each activity
UPDATE game_config
SET config = jsonb_set(config, '{activities,sprint_drills,sharpness_delta}', '-5')
WHERE id = 1;

UPDATE game_config
SET config = jsonb_set(config, '{activities,distance_runs,sharpness_delta}', '-3')
WHERE id = 1;

UPDATE game_config
SET config = jsonb_set(config, '{activities,agility_course,sharpness_delta}', '0')
WHERE id = 1;

UPDATE game_config
SET config = jsonb_set(config, '{activities,gate_work,sharpness_delta}', '5')
WHERE id = 1;

UPDATE game_config
SET config = jsonb_set(config, '{activities,cross_training,sharpness_delta}', '-2')
WHERE id = 1;

UPDATE game_config
SET config = jsonb_set(config, '{activities,mental_prep,sharpness_delta}', '15')
WHERE id = 1;

-- Add new sharpness modifier params (race scoring: 0.80–1.05, 25% swing)
UPDATE game_config
SET config = jsonb_set(config, '{sharpness_mod_floor}', '0.80')
WHERE id = 1;

UPDATE game_config
SET config = jsonb_set(config, '{sharpness_mod_ceiling}', '1.05')
WHERE id = 1;

-- Add sharpness decay params (12h grace, -15/day)
UPDATE game_config
SET config = jsonb_set(config, '{sharpness_grace_hours}', '12')
WHERE id = 1;

UPDATE game_config
SET config = jsonb_set(config, '{sharpness_decay_per_day}', '15')
WHERE id = 1;

-- Add scaled fatigue decay tiers
UPDATE game_config
SET config = jsonb_set(config, '{fatigue_decay_tiers}', '[{"below":30,"rate":3},{"below":60,"rate":6},{"below":80,"rate":10},{"below":101,"rate":15}]'::jsonb)
WHERE id = 1;
