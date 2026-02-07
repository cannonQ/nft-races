-- Add race reward boost columns to creature_stats
-- bonus_actions: 0 or 1 (1st place gets an extra daily training action)
-- boost_multiplier: 0, 0.10, 0.25, or 0.50 (applied to next training gains, then consumed)

ALTER TABLE creature_stats ADD COLUMN IF NOT EXISTS bonus_actions INT DEFAULT 0;
ALTER TABLE creature_stats ADD COLUMN IF NOT EXISTS boost_multiplier NUMERIC(3,2) DEFAULT 0;
