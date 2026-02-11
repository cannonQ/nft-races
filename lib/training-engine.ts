/**
 * Training Engine v2
 * Core training logic for the CyberPets seasonal training system.
 *
 * All tunable constants come from the game_config table (single row, id=1).
 * Stats: speed, stamina, accel, agility, heart, focus — each 0-80, total <= 300.
 */

import { createHash } from 'crypto';
import seedrandom from 'seedrandom';
import { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The six trainable stats. */
export type StatName = 'speed' | 'stamina' | 'accel' | 'agility' | 'heart' | 'focus';

/** A map of stat name → numeric value. */
export type Stats = Record<StatName, number>;

/** Activity definition as stored in game_config.activities */
export interface ActivityDef {
  primary: StatName;
  primary_gain: number;
  secondary: StatName;
  secondary_gain: number;
  fatigue_cost: number;
}

/** Result of computeTrainingGains */
export interface TrainingGainsResult {
  statChanges: Partial<Stats>;
  fatigueDelta: number;
  sharpnessDelta: number;
}

/** Result of validateTrainingAction */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  stats?: Stats;
  seasonId?: string;
  /** Raw creature_stats row for boost fields */
  statsRow?: Record<string, any>;
  /** Whether this action will consume a bonus action */
  isBonusAction?: boolean;
}

/** Reward boost values set after a race finish */
export interface RaceRewardBoost {
  bonus_actions: number;
  boost_multiplier: number;
}

/** Condition after decay */
export interface ConditionResult {
  fatigue: number;
  sharpness: number;
}

/** Single race entry for computeRaceResult */
export interface RaceEntry {
  creatureId: string;
  baseStats: Stats;
  trainedStats: Stats;
  fatigue: number;
  sharpness: number;
}

/** Individual race result */
export interface RaceResultEntry {
  creatureId: string;
  position: number;
  performanceScore: number;
  payout: number;
}

/** Full race result */
export interface RaceResultOutput {
  results: RaceResultEntry[];
  totalPool: number;
}

// Ordered stat keys for deterministic iteration
export const STAT_KEYS: StatName[] = ['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'];

const PER_STAT_CAP = 80;
const TOTAL_STAT_CAP = 300;

/** Boost rewards expire after this many Ergo blocks (~3 days at 720 blocks/day). */
export const BOOST_EXPIRY_BLOCKS = 2160;

// ---------------------------------------------------------------------------
// Training gains
// ---------------------------------------------------------------------------

/**
 * Compute stat gains for a training activity, applying diminishing returns and
 * respecting per-stat (80) and total (300) caps.
 *
 * Diminishing returns formula: gain = base_gain * (1 - current_stat / 80)
 */
export function computeTrainingGains(
  activity: string,
  currentStats: Stats,
  config: Record<string, any>,
): TrainingGainsResult {
  const activityDef: ActivityDef | undefined = config.activities?.[activity];
  if (!activityDef) {
    throw new Error(`Unknown activity: ${activity}`);
  }

  const rawGains: Partial<Stats> = {};

  // Primary stat gain with diminishing returns
  const primaryCurrent = currentStats[activityDef.primary] ?? 0;
  rawGains[activityDef.primary] =
    activityDef.primary_gain * (1 - primaryCurrent / PER_STAT_CAP);

  // Secondary stat gain with diminishing returns
  const secondaryCurrent = currentStats[activityDef.secondary] ?? 0;
  rawGains[activityDef.secondary] =
    (rawGains[activityDef.secondary] ?? 0) +
    activityDef.secondary_gain * (1 - secondaryCurrent / PER_STAT_CAP);

  // Clamp each stat to per-stat cap
  for (const key of STAT_KEYS) {
    if (rawGains[key] !== undefined) {
      const newVal = (currentStats[key] ?? 0) + rawGains[key]!;
      if (newVal > PER_STAT_CAP) {
        rawGains[key] = Math.max(0, PER_STAT_CAP - (currentStats[key] ?? 0));
      }
    }
  }

  // Check total budget
  const currentTotal = STAT_KEYS.reduce((sum, k) => sum + (currentStats[k] ?? 0), 0);
  const gainsTotal = STAT_KEYS.reduce((sum, k) => sum + (rawGains[k] ?? 0), 0);

  if (currentTotal + gainsTotal > TOTAL_STAT_CAP) {
    const available = Math.max(0, TOTAL_STAT_CAP - currentTotal);
    if (gainsTotal > 0 && available > 0) {
      const scale = available / gainsTotal;
      for (const key of STAT_KEYS) {
        if (rawGains[key] !== undefined) {
          rawGains[key] = rawGains[key]! * scale;
        }
      }
    } else {
      // No room — zero out all gains
      for (const key of STAT_KEYS) {
        if (rawGains[key] !== undefined) rawGains[key] = 0;
      }
    }
  }

  // Round to 2 decimal places for storage
  for (const key of STAT_KEYS) {
    if (rawGains[key] !== undefined) {
      rawGains[key] = Math.round(rawGains[key]! * 100) / 100;
    }
  }

  return {
    statChanges: rawGains,
    fatigueDelta: activityDef.fatigue_cost,
    sharpnessDelta: 20,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a creature can perform a training action right now.
 * Checks: season active, daily action limit (2 + bonus_actions), dynamic cooldown.
 *
 * Cooldown = 24 / maxActions hours (12h normal, 8h with bonus action).
 */
export async function validateTrainingAction(
  creatureId: string,
  seasonId: string,
  supabase: SupabaseClient,
): Promise<ValidationResult> {
  // 1. Check season is active
  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .select('id, status')
    .eq('id', seasonId)
    .single();

  if (seasonErr || !season) {
    return { valid: false, reason: 'Season not found' };
  }
  if (season.status !== 'active') {
    return { valid: false, reason: `Season is not active (status: ${season.status})` };
  }

  // 2. Fetch creature_stats
  const { data: stats, error: statsErr } = await supabase
    .from('creature_stats')
    .select('*')
    .eq('creature_id', creatureId)
    .eq('season_id', seasonId)
    .single();

  if (statsErr || !stats) {
    return { valid: false, reason: 'Creature stats not found for this season' };
  }

  const ALPHA_TESTING = false;

  const BASE_ACTIONS = 2;
  const COOLDOWN_HOURS = 6;
  const bonusActions = stats.bonus_actions ?? 0;

  // Bonus actions are consumed first, then regular daily actions.
  const isBonusAction = bonusActions > 0;

  if (!isBonusAction) {
    // 3. Count only regular (non-bonus) actions today for daily limit
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count: regularToday } = await supabase
      .from('training_log')
      .select('*', { count: 'exact', head: true })
      .eq('creature_id', creatureId)
      .eq('season_id', seasonId)
      .eq('bonus_action', false)
      .gte('created_at', todayStart.toISOString());

    const regularCount = regularToday ?? 0;

    // 3b. Daily regular action limit
    if (!ALPHA_TESTING && regularCount >= BASE_ACTIONS) {
      return { valid: false, reason: 'No actions remaining today' };
    }

    // 4. Cooldown: 6 hours between regular actions.
    if (!ALPHA_TESTING && stats.last_action_at) {
      const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
      const lastAction = new Date(stats.last_action_at).getTime();
      const now = Date.now();

      if (lastAction + cooldownMs > now) {
        const remainingMs = lastAction + cooldownMs - now;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.ceil((remainingMs % (1000 * 60 * 60)) / (60 * 1000));
        const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        return {
          valid: false,
          reason: `Cooldown active — ${timeStr} remaining`,
        };
      }
    }
  }
  // Bonus actions bypass both daily limit and cooldown

  const currentStats: Stats = {
    speed: stats.speed ?? 0,
    stamina: stats.stamina ?? 0,
    accel: stats.accel ?? 0,
    agility: stats.agility ?? 0,
    heart: stats.heart ?? 0,
    focus: stats.focus ?? 0,
  };

  return { valid: true, stats: currentStats, seasonId, statsRow: stats, isBonusAction };
}

// ---------------------------------------------------------------------------
// Condition decay
// ---------------------------------------------------------------------------

/**
 * Natural condition decay based on time since last activity.
 *
 * Fatigue:  -3 per 24 h (prorated), floor 0
 * Sharpness:
 *   0-12 h  → no decay (recently trained)
 *   12-24 h → stays high (recovery window)
 *   > 24 h  → -10 per day prorated
 * Both clamped 0-100.
 */
export function applyConditionDecay(
  fatigue: number,
  sharpness: number,
  lastActionAt: Date | string | null,
): ConditionResult {
  if (!lastActionAt) {
    return { fatigue: clamp(fatigue, 0, 100), sharpness: clamp(sharpness, 0, 100) };
  }

  const lastTime = typeof lastActionAt === 'string' ? new Date(lastActionAt) : lastActionAt;
  const hoursSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);

  // Fatigue decay: -3 per 24h prorated
  const fatigueDecay = (hoursSince / 24) * 3;
  const newFatigue = Math.max(0, fatigue - fatigueDecay);

  // Sharpness decay
  let newSharpness = sharpness;
  if (hoursSince > 24) {
    const daysOverWindow = (hoursSince - 24) / 24;
    newSharpness = sharpness - daysOverWindow * 10;
  }
  // 0-12h and 12-24h: no decay

  return {
    fatigue: clamp(Math.round(newFatigue * 100) / 100, 0, 100),
    sharpness: clamp(Math.round(newSharpness * 100) / 100, 0, 100),
  };
}

// ---------------------------------------------------------------------------
// Race simulation (v2 — stat-based with deterministic RNG)
// ---------------------------------------------------------------------------

/**
 * Deterministic float from a seed string, in range [-1.0, 1.0].
 */
function seedToFloat(hexSeed: string): number {
  const rng = seedrandom(hexSeed);
  return rng() * 2 - 1; // map [0,1) → [-1,1)
}

/**
 * Compute race results from entries, weighted by race type, conditioned on
 * fatigue/sharpness, with focus-compressed RNG seeded from a block hash.
 */
export function computeRaceResult(
  entries: RaceEntry[],
  raceType: string,
  blockHash: string,
  config: Record<string, any>,
): RaceResultOutput {
  const weights: Record<StatName, number> | undefined = config.race_type_weights?.[raceType];
  if (!weights) {
    throw new Error(`Unknown race type: ${raceType}`);
  }

  const scored = entries.map((entry) => {
    // 1. Effective stats
    const effective: Stats = {} as Stats;
    for (const key of STAT_KEYS) {
      effective[key] = (entry.baseStats[key] ?? 0) + (entry.trainedStats[key] ?? 0);
    }

    // 2. Weighted score
    const weighted = STAT_KEYS.reduce(
      (sum, key) => sum + effective[key] * (weights[key] ?? 0),
      0,
    );

    // 3. Fatigue modifier: 1.0 - (fatigue / 200) → range [0.50, 1.00]
    const fatigueMod = 1.0 - entry.fatigue / 200;

    // 4. Sharpness modifier: 0.90 + (sharpness / 1000) → range [0.90, 1.00]
    const sharpnessMod = 0.90 + entry.sharpness / 1000;

    // 5. RNG seed from block hash + creature id
    const rngSeed = createHash('sha256')
      .update(blockHash + entry.creatureId)
      .digest('hex');

    // 6. RNG value in [-1, 1]
    const rngValue = seedToFloat(rngSeed);

    // 7. Focus swing — compressed by focus stat
    const focusSwing = 0.30 * (1 - effective.focus / (PER_STAT_CAP + entry.baseStats.focus));

    // 8. RNG modifier
    const rngMod = rngValue * focusSwing;

    // 9. Final score
    const finalScore = weighted * fatigueMod * sharpnessMod * (1 + rngMod);

    return { creatureId: entry.creatureId, performanceScore: finalScore };
  });

  // Sort descending
  scored.sort((a, b) => b.performanceScore - a.performanceScore);

  // Prize distribution from config or defaults
  const prizeDistribution: number[] = config.prize_distribution ?? [0.50, 0.30, 0.20];
  const totalPool = entries.length; // abstract pool units — caller decides ERG amounts

  const results: RaceResultEntry[] = scored.map((s, i) => ({
    creatureId: s.creatureId,
    position: i + 1,
    performanceScore: Math.round(s.performanceScore * 1000) / 1000,
    payout: i < prizeDistribution.length && entries.length >= 3
      ? prizeDistribution[i]
      : 0,
  }));

  return { results, totalPool };
}

// ---------------------------------------------------------------------------
// Race reward boosts
// ---------------------------------------------------------------------------

/**
 * Determine the reward boost values for a given race finish position.
 * 1st: bonus action, 2nd: +50% boost, 3rd: +25% boost, 4th+: +10% boost.
 */
export function getRaceRewardBoost(position: number): RaceRewardBoost {
  if (position === 1) {
    return { bonus_actions: 1, boost_multiplier: 0 };
  } else if (position === 2) {
    return { bonus_actions: 0, boost_multiplier: 0.50 };
  } else if (position === 3) {
    return { bonus_actions: 0, boost_multiplier: 0.25 };
  } else {
    // 4th and beyond — participation reward
    return { bonus_actions: 0, boost_multiplier: 0.10 };
  }
}

/**
 * Apply race reward boosts to all entrants after resolution.
 * - 1st place: +1 bonus_action on creature_stats
 * - 2nd–4th+: discrete boost_rewards row (UTXO-style, expires after BOOST_EXPIRY_BLOCKS)
 */
export async function applyRaceRewards(
  results: RaceResultEntry[],
  seasonId: string,
  raceId: string,
  blockHeight: number,
  supabase: SupabaseClient,
): Promise<void> {
  for (const entry of results) {
    const boost = getRaceRewardBoost(entry.position);

    // Bonus actions still live on creature_stats
    if (boost.bonus_actions > 0) {
      const { data: current } = await supabase
        .from('creature_stats')
        .select('bonus_actions')
        .eq('creature_id', entry.creatureId)
        .eq('season_id', seasonId)
        .single();

      await supabase
        .from('creature_stats')
        .update({
          bonus_actions: (current?.bonus_actions ?? 0) + boost.bonus_actions,
        })
        .eq('creature_id', entry.creatureId)
        .eq('season_id', seasonId);
    }

    // Boost multiplier → discrete boost_rewards row
    if (boost.boost_multiplier > 0) {
      await supabase.from('boost_rewards').insert({
        creature_id: entry.creatureId,
        season_id: seasonId,
        race_id: raceId,
        multiplier: boost.boost_multiplier,
        awarded_at_height: blockHeight,
        expires_at_height: blockHeight + BOOST_EXPIRY_BLOCKS,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
