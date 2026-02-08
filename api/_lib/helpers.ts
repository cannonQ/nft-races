import { supabase } from './supabase';
import { applyConditionDecay } from '../../lib/training-engine';
import { nanoErgToErg } from './constants';

const STAT_KEYS = ['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'] as const;

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

/**
 * Assemble a CreatureWithStats response object from DB rows.
 * Matches the shape in src/types/game.ts (CreatureWithStats interface).
 */
export function computeCreatureResponse(
  creatureRow: Record<string, any>,
  statsRow: Record<string, any> | null,
  prestigeRow: Record<string, any> | null,
  actionsToday: number,
) {
  const trainedStats = {
    speed: statsRow?.speed ?? 0,
    stamina: statsRow?.stamina ?? 0,
    accel: statsRow?.accel ?? 0,
    agility: statsRow?.agility ?? 0,
    heart: statsRow?.heart ?? 0,
    focus: statsRow?.focus ?? 0,
  };

  const totalTrained = STAT_KEYS.reduce((sum, k) => sum + trainedStats[k], 0);
  const maxActionsToday = 2 + (statsRow?.bonus_actions ?? 0);
  const actionsRemaining = Math.max(0, maxActionsToday - actionsToday);

  // Apply real-time condition decay
  const { fatigue, sharpness } = applyConditionDecay(
    statsRow?.fatigue ?? 0,
    statsRow?.sharpness ?? 50,
    statsRow?.last_action_at ?? null,
  );

  // Compute cooldown
  let cooldownEndsAt: string | null = null;
  if (statsRow?.last_action_at) {
    const cooldownHours = 24 / maxActionsToday;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const lastAction = new Date(statsRow.last_action_at).getTime();
    const readyAt = lastAction + cooldownMs;
    if (readyAt > Date.now()) {
      cooldownEndsAt = new Date(readyAt).toISOString();
    }
  }

  return {
    id: creatureRow.id,
    name: creatureRow.name,
    rarity: creatureRow.rarity,
    tokenId: creatureRow.token_id,
    collectionId: creatureRow.collection_id,
    ownerAddress: creatureRow.owner_address,
    baseStats: creatureRow.base_stats ?? {},
    trainedStats,
    totalTrained: Math.round(totalTrained * 100) / 100,
    fatigue: Math.round(fatigue * 100) / 100,
    sharpness: Math.round(sharpness * 100) / 100,
    bonusActions: statsRow?.bonus_actions ?? 0,
    boostMultiplier: statsRow?.boost_multiplier ?? 0,
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
  };
}
