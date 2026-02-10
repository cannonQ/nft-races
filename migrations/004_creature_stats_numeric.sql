-- Migration 004: Change creature_stats columns from int to numeric(5,2)
-- Reason: Training engine uses diminishing returns formula producing decimal values.
-- Must drop/recreate creature_full_stats view which depends on these columns.

DROP VIEW IF EXISTS creature_full_stats;

ALTER TABLE creature_stats
  ALTER COLUMN speed TYPE numeric(5,2),
  ALTER COLUMN stamina TYPE numeric(5,2),
  ALTER COLUMN accel TYPE numeric(5,2),
  ALTER COLUMN agility TYPE numeric(5,2),
  ALTER COLUMN heart TYPE numeric(5,2),
  ALTER COLUMN focus TYPE numeric(5,2),
  ALTER COLUMN fatigue TYPE numeric(5,2),
  ALTER COLUMN sharpness TYPE numeric(5,2);

CREATE VIEW creature_full_stats AS
SELECT cr.id AS creature_id,
    cr.token_id,
    cr.name,
    cr.owner_address,
    cr.rarity,
    cr.base_stats,
    cr.collection_id,
    cs.speed,
    cs.stamina,
    cs.accel,
    cs.agility,
    cs.heart,
    cs.focus,
    cs.fatigue,
    cs.sharpness,
    cs.action_count,
    cs.race_count,
    cs.last_action_at,
    cs.last_race_at,
    cs.season_id,
    cs.speed + cs.stamina + cs.accel + cs.agility + cs.heart + cs.focus AS total_trained,
    p.total_seasons AS prestige_tier,
    p.lifetime_wins,
    p.lifetime_races,
    p.badges
FROM creatures cr
    LEFT JOIN creature_stats cs ON cs.creature_id = cr.id
    LEFT JOIN seasons s ON s.id = cs.season_id AND s.status = 'active'::text
    LEFT JOIN prestige p ON p.creature_id = cr.id;
