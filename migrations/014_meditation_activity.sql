-- Migration 014: Add meditation activity to game_config
--
-- Phase 2 of fatigue/sharpness rework. Meditation is a recovery action:
-- 0 stat gains, -25 fatigue, +15 sharpness. Uses 1 daily action. Costs 0.01 ERG.

UPDATE game_config
SET config = jsonb_set(config, '{activities,meditation}', '{
  "primary": "focus",
  "primary_gain": 0,
  "secondary": "heart",
  "secondary_gain": 0,
  "fatigue_cost": -25,
  "sharpness_delta": 15
}'::jsonb)
WHERE id = 1;

-- Update training_log CHECK constraint to allow 'meditation'
ALTER TABLE training_log DROP CONSTRAINT training_log_activity_check;
ALTER TABLE training_log ADD CONSTRAINT training_log_activity_check
  CHECK (activity IN ('sprint_drills', 'distance_runs', 'agility_course', 'gate_work', 'cross_training', 'mental_prep', 'meditation'));
