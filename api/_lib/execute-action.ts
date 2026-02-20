/**
 * Shared action executors for training and race entry.
 *
 * Extracted so both the direct API endpoints (Nautilus flow with txId)
 * and the ErgoPay status-poll endpoint can call the same logic.
 */
import { supabase } from './supabase.js';
import { getActiveSeason, getLatestErgoBlock, getOrCreateCreatureStats } from './helpers.js';
import { getGameConfig } from './config.js';
import {
  validateTrainingAction,
  computeTrainingGains,
  applyConditionDecay,
  STAT_KEYS,
} from '../../lib/training-engine.js';
import { verifyNFTOwnership } from '../../lib/ergo/server.js';
import { recordLedgerEntry } from './credit-ledger.js';
import { TRAINING_FEE_NANOERG, REQUIRE_FEES, CLASS_RARITIES } from './constants.js';
import type { RarityClass } from './constants.js';
import { getUtcMidnightToday } from './helpers.js';

// ============================================
// Types
// ============================================

export interface ExecuteTrainingParams {
  creatureId: string;
  activity: string;
  walletAddress: string;
  boostRewardIds?: string[];
  recoveryRewardIds?: string[];
  txId?: string;
  paymentCurrency?: 'erg' | 'token';
  feeTokenId?: string;
  feeTokenAmount?: number;
}

export interface ExecuteTrainingResult {
  success: boolean;
  statChanges: Record<string, number>;
  newStats: Record<string, number>;
  fatigue: number;
  sharpness: number;
  boostUsed: boolean;
  totalBoostMultiplier: number;
  boostsConsumed: string[];
  recoveriesConsumed: string[];
  recoveryApplied: number;
  actionsRemaining: number;
  nextActionAt: string | null;
}

export interface ExecuteRaceEntryParams {
  raceId: string;
  creatureId: string;
  walletAddress: string;
  txId?: string;
  paymentCurrency?: 'erg' | 'token';
  feeTokenId?: string;
  feeTokenAmount?: number;
}

export interface ExecuteRaceEntryResult {
  success: boolean;
  entryId: string;
}

// ============================================
// Types (B2-1: replace `as any` with typed interface)
// ============================================

interface CreatureRow {
  id: string;
  token_id: string;
  owner_address: string | null;
  collection_id: string;
  base_stats?: Record<string, number>;
  rarity?: string;
  ownership_verified_at?: string | null;
}

// ============================================
// Shared validation: creature exists + NFT ownership
// ============================================

/** Max hours to trust cached ownership when Explorer is unavailable (B1-3) */
const OWNERSHIP_STALENESS_HOURS = 24;

async function verifyCreatureOwnership(
  creatureId: string,
  walletAddress: string,
  selectFields: string = 'id, owner_address, token_id, collection_id, ownership_verified_at'
): Promise<CreatureRow> {
  const { data: creature, error: creatureErr } = await supabase
    .from('creatures')
    .select(selectFields)
    .eq('id', creatureId)
    .single<CreatureRow>();

  if (creatureErr || !creature) {
    throw new ActionError(400, 'Creature not found');
  }

  const ownership = await verifyNFTOwnership(walletAddress, creature.token_id);
  if (!ownership.ownsToken) {
    // Explorer API was unreachable — trust the DB owner_address with staleness check (B1-3)
    if (ownership.apiUnavailable) {
      if (creature.owner_address === walletAddress) {
        const verifiedAt = creature.ownership_verified_at ? new Date(creature.ownership_verified_at) : null;
        const staleMs = OWNERSHIP_STALENESS_HOURS * 60 * 60 * 1000;
        if (!verifiedAt || (Date.now() - verifiedAt.getTime()) > staleMs) {
          throw new ActionError(503, 'Ownership verification is temporarily unavailable and cached verification has expired. Please try again later.');
        }
        console.warn(`Explorer API unavailable — trusting cached verification (${Math.round((Date.now() - verifiedAt.getTime()) / 3600000)}h old) for creature ${creatureId}`);
      } else {
        throw new ActionError(503, 'Ownership verification temporarily unavailable. Please try again.');
      }
    } else {
      // Confirmed not owner — clear stale DB record
      if (creature.owner_address === walletAddress) {
        await supabase.from('creatures').update({ owner_address: null, ownership_verified_at: null }).eq('id', creatureId);
      }
      throw new ActionError(403, 'You no longer own this NFT on-chain');
    }
  }

  // On-chain verification succeeded — update owner + timestamp (B1-3)
  if (creature.owner_address !== walletAddress || ownership.ownsToken) {
    await supabase.from('creatures').update({
      owner_address: walletAddress,
      ownership_verified_at: new Date().toISOString(),
    }).eq('id', creatureId);
  }

  return creature;
}

// ============================================
// ActionError for structured error handling
// ============================================

export class ActionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ActionError';
  }
}

// ============================================
// executeTraining
// ============================================

export async function executeTraining(params: ExecuteTrainingParams): Promise<ExecuteTrainingResult> {
  const { creatureId, activity, walletAddress, boostRewardIds, recoveryRewardIds, txId, paymentCurrency, feeTokenId, feeTokenAmount } = params;

  // 1. Verify creature + ownership
  const creature = await verifyCreatureOwnership(creatureId, walletAddress);

  // 2. Get active season
  const season = await getActiveSeason(creature.collection_id);
  if (!season) {
    throw new ActionError(400, 'No active season for this collection');
  }

  // 3. Load merged game config
  const mergedConfig = await getGameConfig(creature.collection_id);
  if (!mergedConfig) {
    throw new ActionError(500, 'Failed to load game config');
  }

  // 4. Ensure creature has stats (lazy init)
  const creatureStats = await getOrCreateCreatureStats(creatureId, season.id);
  if (!creatureStats) {
    throw new ActionError(400, 'Failed to load creature stats for this season');
  }

  // 5. Validate training action
  const validation = await validateTrainingAction(creatureId, season.id, supabase, mergedConfig);
  if (!validation.valid) {
    throw new ActionError(400, validation.reason!);
  }

  // 6. Compute training gains
  const currentStats = validation.stats!;
  const gains = computeTrainingGains(activity, currentStats, mergedConfig);

  // 7. Validate + apply boosts
  const selectedBoostIds: string[] = Array.isArray(boostRewardIds) ? boostRewardIds : [];
  let totalBoostMultiplier = 0;
  let boostUsed = false;
  let validatedBoosts: any[] = [];

  if (selectedBoostIds.length > 0) {
    const { data: boostRows, error: boostErr } = await supabase
      .from('boost_rewards')
      .select('*')
      .in('id', selectedBoostIds)
      .eq('creature_id', creatureId)
      .is('spent_at', null);

    if (boostErr || !boostRows || boostRows.length !== selectedBoostIds.length) {
      throw new ActionError(400, 'One or more selected boosts are invalid, already spent, or do not belong to this creature');
    }

    const { height: currentHeight } = await getLatestErgoBlock();
    const expired = boostRows.filter(b => b.expires_at_height <= currentHeight);
    if (expired.length > 0) {
      throw new ActionError(400, `${expired.length} selected boost(s) have expired`);
    }

    validatedBoosts = boostRows;
    totalBoostMultiplier = boostRows.reduce((sum: number, b: any) => sum + Number(b.multiplier), 0);
    boostUsed = true;

    for (const key of STAT_KEYS) {
      if (gains.statChanges[key] !== undefined) {
        gains.statChanges[key] = Math.round(gains.statChanges[key]! * (1 + totalBoostMultiplier) * 100) / 100;
      }
    }
  }

  // 7b. Validate + apply recovery packs
  const selectedRecoveryIds: string[] = Array.isArray(recoveryRewardIds) ? recoveryRewardIds : [];
  let totalRecoveryReduction = 0;
  let validatedRecoveries: any[] = [];

  if (selectedRecoveryIds.length > 0) {
    const { data: recoveryRows, error: recoveryErr } = await supabase
      .from('recovery_rewards')
      .select('*')
      .in('id', selectedRecoveryIds)
      .eq('creature_id', creatureId)
      .is('consumed_at', null);

    if (recoveryErr || !recoveryRows || recoveryRows.length !== selectedRecoveryIds.length) {
      throw new ActionError(400, 'One or more selected recovery packs are invalid, already consumed, or do not belong to this creature');
    }

    // Check expiry if we haven't fetched block height yet
    let currentHeight: number;
    if (boostUsed) {
      // Already fetched in boost section — reuse
      const block = await getLatestErgoBlock();
      currentHeight = block.height;
    } else {
      const block = await getLatestErgoBlock();
      currentHeight = block.height;
    }

    const expired = recoveryRows.filter((r: any) => r.expires_at_height <= currentHeight);
    if (expired.length > 0) {
      throw new ActionError(400, `${expired.length} selected recovery pack(s) have expired`);
    }

    validatedRecoveries = recoveryRows;
    totalRecoveryReduction = recoveryRows.reduce((sum: number, r: any) => sum + Math.abs(Number(r.fatigue_reduction)), 0);
  }

  // 8. Compute new stat values
  const perStatCap = mergedConfig.per_stat_cap ?? 80;
  const newStats = { ...currentStats };
  for (const key of STAT_KEYS) {
    if (gains.statChanges[key] !== undefined) {
      newStats[key] = Math.round(Math.min(perStatCap, newStats[key] + gains.statChanges[key]!) * 100) / 100;
    }
  }

  // 9. Compute new condition values (recovery packs reduce fatigue)
  const rawFatigue = (validation.statsRow?.fatigue ?? 0) + gains.fatigueDelta - totalRecoveryReduction;
  const rawSharpness = Math.min(100, (validation.statsRow?.sharpness ?? 50) + gains.sharpnessDelta);
  const fatigue = Math.max(0, Math.min(100, Math.round(rawFatigue * 100) / 100));
  const sharpness = Math.max(0, Math.round(rawSharpness * 100) / 100);

  const now = new Date().toISOString();
  const isBonusAction = validation.isBonusAction ?? false;
  const currentBonusActions = validation.statsRow?.bonus_actions ?? 0;

  // 10. Insert training log FIRST
  const { data: logRow, error: logErr } = await supabase.from('training_log').insert({
    creature_id: creatureId,
    season_id: season.id,
    owner_address: walletAddress,
    activity,
    stat_changes: gains.statChanges,
    fatigue_change: gains.fatigueDelta,
    sharpness_change: gains.sharpnessDelta,
    boosted: boostUsed,
    bonus_action: isBonusAction,
  }).select('id').single();

  if (logErr || !logRow) {
    console.error('Training log insert error:', logErr);
    throw new ActionError(500, 'Failed to record training action');
  }

  // 10b. Mark boosts as spent (B4-1/B1-2: throw on failure to prevent double-spend)
  if (validatedBoosts.length > 0) {
    const spentAt = new Date().toISOString();
    const { error: spendErr } = await supabase
      .from('boost_rewards')
      .update({ spent_at: spentAt, spent_in_training_log_id: logRow.id })
      .in('id', validatedBoosts.map((b: any) => b.id));

    if (spendErr) {
      console.error('Failed to mark boosts as spent:', spendErr);
      throw new ActionError(500, 'Failed to consume boost rewards — training cancelled');
    }
  }

  // 10b2. Mark recovery packs as consumed (B4-1/B1-2: throw on failure)
  if (validatedRecoveries.length > 0) {
    const consumedAt = new Date().toISOString();
    const { error: consumeErr } = await supabase
      .from('recovery_rewards')
      .update({ consumed_at: consumedAt, consumed_in_training_log_id: logRow.id })
      .in('id', validatedRecoveries.map((r: any) => r.id));

    if (consumeErr) {
      console.error('Failed to mark recovery packs as consumed:', consumeErr);
      throw new ActionError(500, 'Failed to consume recovery packs — training cancelled');
    }
  }

  // 10c. Record ledger entry (must await — serverless kills process after response)
  await recordLedgerEntry({
    ownerAddress: walletAddress,
    txType: 'training_fee',
    amountNanoerg: -TRAINING_FEE_NANOERG,
    creatureId,
    seasonId: season.id,
    trainingLogId: logRow.id,
    memo: `Training: ${activity}`,
    txId,
    shadow: !txId,
    feeTokenId: paymentCurrency === 'token' ? feeTokenId : undefined,
    feeTokenAmount: paymentCurrency === 'token' ? feeTokenAmount : undefined,
  });

  // 11. Update creature_stats
  const newBonusActions = isBonusAction
    ? Math.max(0, currentBonusActions - 1)
    : currentBonusActions;

  const { error: updateErr } = await supabase
    .from('creature_stats')
    .update({
      ...newStats,
      fatigue,
      sharpness,
      last_action_at: now,
      action_count: (validation.statsRow?.action_count ?? 0) + 1,
      bonus_actions: newBonusActions,
    })
    .eq('creature_id', creatureId)
    .eq('season_id', season.id);

  if (updateErr) {
    console.error('Stats update error:', updateErr);
    throw new ActionError(500, 'Failed to update creature stats');
  }

  // 12. Compute actions remaining
  const BASE_ACTIONS = mergedConfig.base_actions ?? 2;
  const COOLDOWN_HOURS = mergedConfig.cooldown_hours ?? 6;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count: regularToday } = await supabase
    .from('training_log')
    .select('*', { count: 'exact', head: true })
    .eq('creature_id', creatureId)
    .eq('season_id', season.id)
    .eq('bonus_action', false)
    .gte('created_at', todayStart.toISOString());

  const regularRemaining = Math.max(0, BASE_ACTIONS - (regularToday ?? 0));
  const actionsRemaining = newBonusActions + regularRemaining;

  const nextIsBonusAction = newBonusActions > 0;
  const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
  const readyAt = nextIsBonusAction ? new Date() : new Date(Date.now() + cooldownMs);
  const nextActionAt = actionsRemaining > 0 ? readyAt.toISOString() : null;

  return {
    success: true,
    statChanges: gains.statChanges,
    newStats,
    fatigue,
    sharpness,
    boostUsed,
    totalBoostMultiplier,
    boostsConsumed: validatedBoosts.map((b: any) => b.id),
    recoveriesConsumed: validatedRecoveries.map((r: any) => r.id),
    recoveryApplied: totalRecoveryReduction,
    actionsRemaining,
    nextActionAt,
  };
}

// ============================================
// executeRaceEntry
// ============================================

export async function executeRaceEntry(params: ExecuteRaceEntryParams): Promise<ExecuteRaceEntryResult> {
  const { raceId, creatureId, walletAddress, txId, paymentCurrency, feeTokenId, feeTokenAmount } = params;

  // 1. Verify creature + ownership
  const creature = await verifyCreatureOwnership(
    creatureId,
    walletAddress,
    'id, token_id, owner_address, base_stats, collection_id, ownership_verified_at'
  );

  // 2. Verify race exists and is open
  const { data: race, error: raceErr } = await supabase
    .from('season_races')
    .select('*, seasons!inner(collection_id)')
    .eq('id', raceId)
    .single();

  if (raceErr || !race) {
    throw new ActionError(400, 'Race not found');
  }

  if (race.status !== 'open') {
    throw new ActionError(400, `Race is not open (status: ${race.status})`);
  }

  if (new Date(race.entry_deadline) < new Date()) {
    throw new ActionError(400, 'Race entry deadline has passed');
  }

  // 2b. Collection guard
  const raceCollectionId = race.seasons?.collection_id;
  if (raceCollectionId && creature.collection_id !== raceCollectionId) {
    throw new ActionError(400, 'This creature cannot enter this race — collection mismatch');
  }

  // 2c. Rarity class guard
  if (race.rarity_class) {
    const allowedRarities = CLASS_RARITIES[race.rarity_class as RarityClass];
    if (!allowedRarities) {
      throw new ActionError(400, `Unknown rarity class: ${race.rarity_class}`);
    }
    // Look up creature rarity from DB
    const { data: creatureData } = await supabase
      .from('creatures')
      .select('rarity')
      .eq('id', creatureId)
      .single();
    const creatureRarity = (creatureData?.rarity ?? '').toLowerCase();
    if (!allowedRarities.includes(creatureRarity)) {
      throw new ActionError(400, `This race is restricted to ${race.rarity_class} class (${allowedRarities.join(', ')})`);
    }
  }

  // 3. Entry count check
  const { count: entryCount } = await supabase
    .from('season_race_entries')
    .select('*', { count: 'exact', head: true })
    .eq('race_id', raceId);

  if ((entryCount ?? 0) >= race.max_entries) {
    throw new ActionError(400, 'Race is full');
  }

  // 4. Duplicate check
  const { data: existing } = await supabase
    .from('season_race_entries')
    .select('id')
    .eq('race_id', raceId)
    .eq('creature_id', creatureId)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new ActionError(400, 'Creature is already entered in this race');
  }

  // 5. Fetch or lazily create creature_stats
  const stats = await getOrCreateCreatureStats(creatureId, race.season_id);
  if (!stats) {
    throw new ActionError(400, 'Failed to load creature stats for this season');
  }

  // 5b. Treatment lockout: reject if creature is currently in treatment
  if (stats.treatment_type && stats.treatment_ends_at) {
    if (new Date(stats.treatment_ends_at) > new Date()) {
      throw new ActionError(400, 'Creature is currently in treatment and cannot enter races');
    }
  }

  // 5c. Load merged game config for condition decay
  const mergedConfig = await getGameConfig(creature.collection_id);

  // 6. Snapshot current stats with real-time condition decay (scaled fatigue + faster sharpness)
  const { fatigue, sharpness } = applyConditionDecay(
    stats.fatigue ?? 0,
    stats.sharpness ?? 50,
    stats.last_action_at,
    mergedConfig ?? undefined,
  );

  const snapshotStats = {
    speed: stats.speed ?? 0,
    stamina: stats.stamina ?? 0,
    accel: stats.accel ?? 0,
    agility: stats.agility ?? 0,
    heart: stats.heart ?? 0,
    focus: stats.focus ?? 0,
  };

  // 7. Insert entry
  const { data: entry, error: insertErr } = await supabase
    .from('season_race_entries')
    .insert({
      race_id: raceId,
      creature_id: creatureId,
      owner_address: walletAddress,
      snapshot_stats: snapshotStats,
      snapshot_base_stats: creature.base_stats,
      snapshot_fatigue: Math.round(fatigue),
      snapshot_sharpness: Math.round(sharpness),
    })
    .select('id')
    .single();

  if (insertErr || !entry) {
    console.error('Race entry insert error:', insertErr);
    throw new ActionError(500, 'Failed to create race entry');
  }

  // 8. Record ledger entry (must await — serverless kills process after response)
  const entryFeeNanoerg = race.entry_fee_nanoerg ?? 0;
  if (entryFeeNanoerg > 0) {
    await recordLedgerEntry({
      ownerAddress: walletAddress,
      txType: 'race_entry_fee',
      amountNanoerg: -entryFeeNanoerg,
      creatureId,
      raceId,
      seasonId: race.season_id,
      raceEntryId: entry.id,
      memo: `Race entry: ${race.name}`,
      txId,
      shadow: !txId,
      feeTokenId: paymentCurrency === 'token' ? feeTokenId : undefined,
      feeTokenAmount: paymentCurrency === 'token' ? feeTokenAmount : undefined,
    });
  }

  // 9. Update creature_stats
  await supabase
    .from('creature_stats')
    .update({
      last_race_at: new Date().toISOString(),
      race_count: (stats.race_count ?? 0) + 1,
    })
    .eq('creature_id', creatureId)
    .eq('season_id', race.season_id);

  return { success: true, entryId: entry.id };
}
