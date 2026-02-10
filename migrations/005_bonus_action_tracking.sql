-- Migration 005: Track bonus action usage in training_log
-- Bonus actions are consumed first, then regular daily actions.
-- This column lets us count regular vs bonus actions separately.

ALTER TABLE training_log ADD COLUMN bonus_action boolean NOT NULL DEFAULT false;
