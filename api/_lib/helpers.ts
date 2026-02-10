import { supabase } from './supabase';
import { applyConditionDecay } from '../../lib/training-engine';
import { nanoErgToErg } from './constants';

const ERGO_EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

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

/** Derive display name from metadata (e.g., "Ostrich 247") with fallback to DB name. */
export function getCreatureDisplayName(metadata: any, fallbackName: string): string {
  if (metadata?.pet && metadata?.number != null) {
    return `${metadata.pet} ${metadata.number}`;
  }
  return fallbackName;
}

/** Build the standard CyberPet image URL from the token number. */
export function getCreatureImageUrl(metadata: any): string | undefined {
  return metadata?.number
    ? `https://api.ergexplorer.com/nftcache/QmeQZUQJiKQYZ2dQ795491ykn1ikEv3bNJ1Aa1uyGs1aJw_${metadata.number}.png.png`
    : undefined;
}

/** Get ISO string for start of today in UTC */
export function getUtcMidnightToday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Fetch the single active season. Returns null if none. */
export async function getActiveSeason() {
  const { data, error } = await supabase
    .from('seasons')
    .select('*, collections(name)')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

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

/**
 * Assemble a CreatureWithStats response object from DB rows.
 * @param regularActionsToday — count of NON-bonus training actions today.
 * @param boostRewards — available (unspent, unexpired) boost_rewards rows.
 */
export function computeCreatureResponse(
  creatureRow: Record<string, any>,
  statsRow: Record<string, any> | null,
  prestigeRow: Record<string, any> | null,
  regularActionsToday: number,
  boostRewards: any[] = [],
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

  // Apply real-time condition decay
  const { fatigue, sharpness } = applyConditionDecay(
    statsRow?.fatigue ?? 0,
    statsRow?.sharpness ?? 50,
    statsRow?.last_action_at ?? null,
  );

  // Compute cooldown: 6h fixed, bonus actions bypass cooldown
  let cooldownEndsAt: string | null = null;
  // If bonus actions remain, next action is bonus → no cooldown
  if (bonusActions === 0 && statsRow?.last_action_at) {
    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
    const lastAction = new Date(statsRow.last_action_at).getTime();
    const readyAt = lastAction + cooldownMs;
    if (readyAt > Date.now()) {
      cooldownEndsAt = new Date(readyAt).toISOString();
    }
  }

  return {
    id: creatureRow.id,
    name: getCreatureDisplayName(creatureRow.metadata, creatureRow.name),
    rarity: creatureRow.rarity,
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
    actionsRemaining,
    maxActionsToday,
    cooldownEndsAt,
    lastActionAt: statsRow?.last_action_at ?? null,
    lastRaceAt: statsRow?.last_race_at ?? null,
    actionCount: statsRow?.action_count ?? 0,
    raceCount: statsRow?.race_count ?? 0,
    totalRaces: prestigeRow?.lifetime_races ?? statsRow?.race_count ?? 0,
    totalEarnings: nanoErgToErg(prestigeRow?.lifetime_earnings_nanoerg ?? 0),
    prestige: {
      tier: prestigeRow?.total_seasons ?? 0,
      lifetimeWins: prestigeRow?.lifetime_wins ?? 0,
      lifetimePlaces: prestigeRow?.lifetime_places ?? 0,
      lifetimeShows: prestigeRow?.lifetime_shows ?? 0,
      lifetimeRaces: prestigeRow?.lifetime_races ?? 0,
      badges: prestigeRow?.badges ?? [],
    },
    imageUrl: getCreatureImageUrl(creatureRow.metadata),
  };
}
