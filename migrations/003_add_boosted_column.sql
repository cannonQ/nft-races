-- Add boosted boolean column to training_log
-- Tracks whether a training action received a boost multiplier from race rewards
ALTER TABLE training_log ADD COLUMN IF NOT EXISTS boosted BOOLEAN DEFAULT false;
