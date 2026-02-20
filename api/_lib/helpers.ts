import { supabase } from './supabase.js';
import { applyConditionDecay } from '../../lib/training-engine.js';
import { nanoErgToErg } from './constants.js';
import type { CollectionLoader } from './collections/types.js';

const ERGO_EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a string is a valid UUID v4 format. */
export function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val);
}

/** Validate a string looks like an Ergo wallet address (base58, 30-60 chars). */
export function isValidErgoAddr(val: unknown): val is string {
  return typeof val === 'string' && /^[1-9A-HJ-NP-Za-km-z]{30,60}$/.test(val);
}

/** Fetch the latest Ergo block hash and height from Explorer. */
export async function getLatestErgoBlock(): Promise<{ hash: string; height: number }> {
  const res = await fetch(`${ERGO_EXPLORER_API}/blocks?limit=1`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Explorer blocks API returned ${res.status}`);
  const data = await res.json();
  const block = data?.items?.[0];
  if (!block?.id) throw new Error('No block returned from explorer');
  return { hash: block.id, height: block.height };
}

const STAT_KEYS = ['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'] as const;

// ---------------------------------------------------------------------------
// Display helpers — collection-aware with CyberPets fallback
// ---------------------------------------------------------------------------

/**
 * Derive display name from metadata.
 * If a collection loader is provided, delegates to it. Otherwise uses CyberPets logic.
 */
export function getCreatureDisplayName(
  metadata: any,
  fallbackName: string,
  loader?: CollectionLoader,
): string {
  if (loader) return loader.getDisplayName(metadata ?? {}, fallbackName);
  // CyberPets default
  if (metadata?.pet && metadata?.number != null) {
    return `${metadata.pet} ${metadata.number}`;
  }
  return fallbackName;
}

/**
 * Build image URL from metadata.
 * If a collection loader is provided, delegates to it. Otherwise uses CyberPets proxy.
 */
export function getCreatureImageUrl(
  metadata: any,
  loader?: CollectionLoader,
): string | undefined {
  if (loader) return loader.getImageUrl(metadata ?? {});
  // CyberPets default
  return metadata?.number
    ? `/api/v2/img/${metadata.number}`
    : undefined;
}

/**
 * Build fallback image URL from metadata.
 * If a collection loader is provided, delegates to it. Otherwise uses cyberversewiki.
 */
export function getCreatureFallbackImageUrl(
  metadata: any,
  loader?: CollectionLoader,
): string | undefined {
  if (loader) return loader.getFallbackImageUrl(metadata ?? {});
  // CyberPets default
  return metadata?.number
    ? `https://www.cyberversewiki.com/img/cyberpets/${metadata.number}.png`
    : undefined;
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** Get ISO string for start of today in UTC */
export function getUtcMidnightToday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Season helpers — multi-collection aware
// ---------------------------------------------------------------------------

/**
 * Fetch an active season, optionally filtered by collection.
 * Without collectionId, returns any active season (backward compat for single-collection callers).
 */
export async function getActiveSeason(collectionId?: string) {
  let query = supabase
    .from('seasons')
    .select('*, collections(name)')
    .eq('status', 'active');

  if (collectionId) {
    query = query.eq('collection_id', collectionId);
  }

  const { data, error } = await query.limit(1).single();
  if (error || !data) return null;
  return data;
}

/**
 * Fetch ALL active seasons (one per collection).
 * Used by endpoints that need to serve data across all collections (e.g., races, dashboard).
 */
export async function getActiveSeasons() {
  const { data, error } = await supabase
    .from('seasons')
    .select('*, collections(name)')
    .eq('status', 'active');

  if (error || !data) return [];
  return data;
}

// ---------------------------------------------------------------------------
// Training action counts
// ---------------------------------------------------------------------------

/** Count training actions performed today (UTC) for a creature in a season */
export async function countActionsToday(
  creatureId: string,
  seasonId: string,
): Promise<number> {
  const { count } = await supabase
    .from('training_log')
    .select('*', { count: 'exact', head: true })
    .eq('creature_id', creatureId)
    .eq('season_id', seasonId)
    .gte('created_at', getUtcMidnightToday());
  return count ?? 0;
}

/** Count only regular (non-bonus) training actions today */
export async function countRegularActionsToday(
  creatureId: string,
  seasonId: string,
): Promise<number> {
  const { count } = await supabase
    .from('training_log')
    .select('*', { count: 'exact', head: true })
    .eq('creature_id', creatureId)
    .eq('season_id', seasonId)
    .eq('bonus_action', false)
    .gte('created_at', getUtcMidnightToday());
  return count ?? 0;
}

/** Get timestamp of the most recent regular (non-bonus) action for cooldown calculation */
export async function getLastRegularActionAt(
  creatureId: string,
  seasonId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('training_log')
    .select('created_at')
    .eq('creature_id', creatureId)
    .eq('season_id', seasonId)
    .eq('bonus_action', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at ?? null;
}

// ---------------------------------------------------------------------------
// Lazy creature_stats initialization
// ---------------------------------------------------------------------------

/**
 * Get creature stats for a season, creating the row if it doesn't exist.
 *
 * With lazy init, season start no longer pre-creates stats for all creatures.
 * Stats are created on first interaction (training, race entry, or profile view).
 * This scales to any collection size — no batch init needed.
 *
 * Also upserts the prestige row (creates if missing, increments total_seasons).
 */
export async function getOrCreateCreatureStats(
  creatureId: string,
  seasonId: string,
): Promise<Record<string, any> | null> {
  // 1. Try fetch first (fast path for existing rows)
  const { data: existing } = await supabase
    .from('creature_stats')
    .select('*')
    .eq('creature_id', creatureId)
    .eq('season_id', seasonId)
    .maybeSingle();

  if (existing) return existing;

  // 2. Not found — create fresh row with zeroed stats
  const { data: inserted, error: insertErr } = await supabase
    .from('creature_stats')
    .insert({
      creature_id: creatureId,
      season_id: seasonId,
      speed: 0,
      stamina: 0,
      accel: 0,
      agility: 0,
      heart: 0,
      focus: 0,
      fatigue: 0,
      sharpness: 50,
      bonus_actions: 0,
      action_count: 0,
      race_count: 0,
    })
    .select('*')
    .single();

  if (insertErr) {
    // Race condition — another request may have created it. Try fetching again.
    const { data: retry } = await supabase
      .from('creature_stats')
      .select('*')
      .eq('creature_id', creatureId)
      .eq('season_id', seasonId)
      .maybeSingle();
    return retry;
  }

  // 3. Upsert prestige (create if missing, increment total_seasons)
  const { data: prestige } = await supabase
    .from('prestige')
    .select('total_seasons')
    .eq('creature_id', creatureId)
    .maybeSingle();

  if (prestige) {
    await supabase
      .from('prestige')
      .update({ total_seasons: (prestige.total_seasons ?? 0) + 1 })
      .eq('creature_id', creatureId);
  } else {
    await supabase.from('prestige').insert({
      creature_id: creatureId,
      total_seasons: 1,
      lifetime_wins: 0,
      lifetime_places: 0,
      lifetime_shows: 0,
      lifetime_races: 0,
      lifetime_earnings_nanoerg: 0,
      badges: [],
    });
  }

  return inserted;
}

// ---------------------------------------------------------------------------
// Creature response assembly
// ---------------------------------------------------------------------------

/**
 * Assemble a CreatureWithStats response object from DB rows.
 *
 * @param creatureRow — from `creatures` table
 * @param statsRow — from `creature_stats` table (null = zeroed stats)
 * @param prestigeRow — from `prestige` table
 * @param regularActionsToday — count of NON-bonus training actions today
 * @param boostRewards — available (unspent, unexpired) boost_rewards rows
 * @param leaderboardRow — current season's season_leaderboard row (W/P/S, races, earnings)
 * @param loader — optional collection loader for image/name resolution
 * @param lastRegularActionAt — timestamp of most recent regular (non-bonus) action (for cooldown)
 * @param gameConfig — optional merged game config (passed to applyConditionDecay for scaled decay)
 */
export function computeCreatureResponse(
  creatureRow: Record<string, any>,
  statsRow: Record<string, any> | null,
  prestigeRow: Record<string, any> | null,
  regularActionsToday: number,
  boostRewards: any[] = [],
  leaderboardRow: Record<string, any> | null = null,
  loader?: CollectionLoader,
  lastRegularActionAt?: string | null,
  gameConfig?: Record<string, any>,
  recoveryRewards: any[] = [],
) {
  const trainedStats = {
    speed: statsRow?.speed ?? 0,
    stamina: statsRow?.stamina ?? 0,
    accel: statsRow?.accel ?? 0,
    agility: statsRow?.agility ?? 0,
    heart: statsRow?.heart ?? 0,
    focus: statsRow?.focus ?? 0,
  };

  const BASE_ACTIONS = 2;
  const COOLDOWN_HOURS = 6;

  const totalTrained = STAT_KEYS.reduce((sum, k) => sum + trainedStats[k], 0);
  const bonusActions = statsRow?.bonus_actions ?? 0;

  // Actions remaining = remaining bonus + remaining regular today
  const regularRemaining = Math.max(0, BASE_ACTIONS - regularActionsToday);
  const actionsRemaining = bonusActions + regularRemaining;
  const maxActionsToday = BASE_ACTIONS + bonusActions;

  // Apply real-time condition decay (uses scaled fatigue + faster sharpness decay)
  const { fatigue, sharpness } = applyConditionDecay(
    statsRow?.fatigue ?? 0,
    statsRow?.sharpness ?? 50,
    statsRow?.last_action_at ?? null,
    gameConfig,
  );

  // Compute cooldown: 6h fixed, bonus actions bypass cooldown.
  // Use lastRegularActionAt (not statsRow.last_action_at) so that bonus actions
  // don't trigger a false cooldown for subsequent regular actions.
  let cooldownEndsAt: string | null = null;
  const cooldownRef = lastRegularActionAt ?? null;
  if (bonusActions === 0 && cooldownRef) {
    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
    const lastAction = new Date(cooldownRef).getTime();
    const readyAt = lastAction + cooldownMs;
    if (readyAt > Date.now()) {
      cooldownEndsAt = new Date(readyAt).toISOString();
    }
  }

  return {
    id: creatureRow.id,
    name: getCreatureDisplayName(creatureRow.metadata, creatureRow.name, loader),
    rarity: (creatureRow.rarity ?? 'common').toLowerCase(),
    tokenId: creatureRow.token_id,
    collectionId: creatureRow.collection_id,
    ownerAddress: creatureRow.owner_address,
    baseStats: creatureRow.base_stats ?? {},
    trainedStats,
    totalTrained: Math.round(totalTrained * 100) / 100,
    fatigue: Math.round(fatigue * 100) / 100,
    sharpness: Math.round(sharpness * 100) / 100,
    bonusActions,
    boosts: boostRewards.map((b: any) => ({
      id: b.id,
      multiplier: Number(b.multiplier),
      awardedAtHeight: b.awarded_at_height,
      expiresAtHeight: b.expires_at_height,
      raceId: b.race_id ?? null,
    })),
    boostMultiplier: boostRewards.reduce((sum: number, b: any) => sum + Number(b.multiplier), 0),
    recoveries: recoveryRewards.map((r: any) => ({
      id: r.id,
      fatigueReduction: Math.abs(Number(r.fatigue_reduction)),
      awardedAtHeight: r.awarded_at_height,
      expiresAtHeight: r.expires_at_height,
      raceId: r.race_id ?? null,
    })),
    actionsRemaining,
    maxActionsToday,
    cooldownEndsAt,
    lastActionAt: statsRow?.last_action_at ?? null,
    lastRaceAt: statsRow?.last_race_at ?? null,
    actionCount: statsRow?.action_count ?? 0,
    raceCount: statsRow?.race_count ?? 0,
    totalRaces: (prestigeRow?.lifetime_races ?? 0) + (leaderboardRow?.races_entered ?? 0),
    totalEarnings: nanoErgToErg(prestigeRow?.lifetime_earnings_nanoerg ?? 0),
    prestige: {
      tier: prestigeRow?.total_seasons ?? 0,
      lifetimeWins: (prestigeRow?.lifetime_wins ?? 0) + (leaderboardRow?.wins ?? 0),
      lifetimePlaces: (prestigeRow?.lifetime_places ?? 0) + (leaderboardRow?.places ?? 0),
      lifetimeShows: (prestigeRow?.lifetime_shows ?? 0) + (leaderboardRow?.shows ?? 0),
      lifetimeRaces: (prestigeRow?.lifetime_races ?? 0) + (leaderboardRow?.races_entered ?? 0),
      badges: prestigeRow?.badges ?? [],
    },
    imageUrl: getCreatureImageUrl(creatureRow.metadata, loader),
    fallbackImageUrl: getCreatureFallbackImageUrl(creatureRow.metadata, loader),
    treatment: statsRow?.treatment_type ? {
      type: statsRow.treatment_type,
      startedAt: statsRow.treatment_started_at,
      endsAt: statsRow.treatment_ends_at,
    } : null,
  };
}

