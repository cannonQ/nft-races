/**
 * Treatment Center executor.
 *
 * executeTreatmentStart() — verify ownership, check not already in treatment,
 *   set lockout columns, insert treatment_log, record ledger entry.
 *
 * checkAndCompleteTreatment() — lazy completion: if treatment_ends_at < now,
 *   apply effects to creature_stats, clear treatment columns, update treatment_log.
 */
import { supabase } from './supabase.js';
import { getActiveSeason, getOrCreateCreatureStats } from './helpers.js';
import { getGameConfig } from './config.js';
import { applyConditionDecay } from '../../lib/training-engine.js';
import { verifyNFTOwnership } from '../../lib/ergo/server.js';
import { recordLedgerEntry } from './credit-ledger.js';
import { ActionError } from './execute-action.js';

// ============================================
// Types
// ============================================

export interface TreatmentDef {
  name: string;
  duration_hours: number;
  fatigue_reduction: number | null;  // null = reset to 0
  sharpness_set: number | null;      // null = unchanged
  cost_nanoerg: number;
}

export interface ExecuteTreatmentParams {
  creatureId: string;
  treatmentType: string;
  walletAddress: string;
  txId?: string;
}

export interface ExecuteTreatmentResult {
  success: boolean;
  treatmentType: string;
  treatmentName: string;
  durationHours: number;
  endsAt: string;
  costNanoerg: number;
}

// ============================================
// executeTreatmentStart
// ============================================

export async function executeTreatmentStart(
  params: ExecuteTreatmentParams,
): Promise<ExecuteTreatmentResult> {
  const { creatureId, treatmentType, walletAddress, txId } = params;

  // 1. Verify creature + ownership
  const { data: creature, error: creatureErr } = await supabase
    .from('creatures')
    .select('id, owner_address, token_id, collection_id')
    .eq('id', creatureId)
    .single();

  if (creatureErr || !creature) {
    throw new ActionError(400, 'Creature not found');
  }

  const ownership = await verifyNFTOwnership(walletAddress, creature.token_id);
  if (!ownership.ownsToken) {
    if (ownership.apiUnavailable) {
      if (creature.owner_address !== walletAddress) {
        throw new ActionError(503, 'Ownership verification temporarily unavailable. Please try again.');
      }
    } else {
      if (creature.owner_address === walletAddress) {
        await supabase.from('creatures').update({ owner_address: null }).eq('id', creatureId);
      }
      throw new ActionError(403, 'You no longer own this NFT on-chain');
    }
  }

  if (creature.owner_address !== walletAddress) {
    await supabase.from('creatures').update({ owner_address: walletAddress }).eq('id', creatureId);
  }

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

  // 4. Validate treatment type
  const treatments: Record<string, TreatmentDef> = mergedConfig.treatments ?? {};
  const treatmentDef = treatments[treatmentType];
  if (!treatmentDef) {
    throw new ActionError(400, `Unknown treatment type: ${treatmentType}`);
  }

  // 5. Ensure creature has stats (lazy init)
  const stats = await getOrCreateCreatureStats(creatureId, season.id);
  if (!stats) {
    throw new ActionError(400, 'Failed to load creature stats for this season');
  }

  // 6. Check not already in treatment
  if (stats.treatment_type && stats.treatment_ends_at) {
    const endsAt = new Date(stats.treatment_ends_at);
    if (endsAt > new Date()) {
      throw new ActionError(400, 'Creature is already in treatment');
    }
    // Treatment expired but wasn't lazily completed — complete it now
    await checkAndCompleteTreatment(creatureId, season.id, mergedConfig);
  }

  // 7. Compute current fatigue/sharpness (with decay)
  const { fatigue, sharpness } = applyConditionDecay(
    stats.fatigue ?? 0,
    stats.sharpness ?? 50,
    stats.last_action_at,
    mergedConfig,
  );

  // 8. Set lockout columns
  const now = new Date();
  const endsAt = new Date(now.getTime() + treatmentDef.duration_hours * 60 * 60 * 1000);

  const { error: updateErr } = await supabase
    .from('creature_stats')
    .update({
      treatment_type: treatmentType,
      treatment_started_at: now.toISOString(),
      treatment_ends_at: endsAt.toISOString(),
      // Snapshot current decayed fatigue/sharpness so lazy completion has correct "before" values
      fatigue: Math.round(fatigue * 100) / 100,
      sharpness: Math.round(sharpness * 100) / 100,
      last_action_at: now.toISOString(),
    })
    .eq('creature_id', creatureId)
    .eq('season_id', season.id);

  if (updateErr) {
    console.error('Treatment start update error:', updateErr);
    throw new ActionError(500, 'Failed to start treatment');
  }

  // 9. Insert treatment_log
  const { error: logErr } = await supabase.from('treatment_log').insert({
    creature_id: creatureId,
    season_id: season.id,
    owner_address: walletAddress,
    treatment_type: treatmentType,
    duration_hours: treatmentDef.duration_hours,
    fatigue_before: Math.round(fatigue * 100) / 100,
    fatigue_after: null, // set on completion
    sharpness_before: Math.round(sharpness * 100) / 100,
    sharpness_after: null, // set on completion
    cost_nanoerg: treatmentDef.cost_nanoerg,
    tx_id: txId ?? null,
    shadow: !txId,
    started_at: now.toISOString(),
  });

  if (logErr) {
    console.error('Treatment log insert error:', logErr);
    // Don't throw — lockout is already set, log is secondary
  }

  // 10. Record ledger entry
  recordLedgerEntry({
    ownerAddress: walletAddress,
    txType: 'treatment_fee',
    amountNanoerg: -treatmentDef.cost_nanoerg,
    creatureId,
    seasonId: season.id,
    memo: `Treatment: ${treatmentDef.name}`,
    txId,
    shadow: !txId,
  });

  return {
    success: true,
    treatmentType,
    treatmentName: treatmentDef.name,
    durationHours: treatmentDef.duration_hours,
    endsAt: endsAt.toISOString(),
    costNanoerg: treatmentDef.cost_nanoerg,
  };
}

// ============================================
// checkAndCompleteTreatment (lazy completion)
// ============================================

/**
 * If the creature's treatment has ended, apply the effects and clear the lockout.
 * Returns true if a treatment was completed, false otherwise.
 *
 * Call this from computeCreatureResponse() and anywhere stats are loaded.
 */
export async function checkAndCompleteTreatment(
  creatureId: string,
  seasonId: string,
  config?: Record<string, any>,
): Promise<boolean> {
  // Fetch current treatment state
  const { data: stats } = await supabase
    .from('creature_stats')
    .select('treatment_type, treatment_started_at, treatment_ends_at, fatigue, sharpness')
    .eq('creature_id', creatureId)
    .eq('season_id', seasonId)
    .maybeSingle();

  if (!stats?.treatment_type || !stats.treatment_ends_at) {
    return false;
  }

  const endsAt = new Date(stats.treatment_ends_at);
  if (endsAt > new Date()) {
    return false; // still in treatment
  }

  // Treatment has ended — apply effects
  const treatments: Record<string, TreatmentDef> = config?.treatments ?? {};
  const treatmentDef = treatments[stats.treatment_type];
  if (!treatmentDef) {
    // Unknown treatment type in DB — just clear the lockout
    await supabase
      .from('creature_stats')
      .update({
        treatment_type: null,
        treatment_started_at: null,
        treatment_ends_at: null,
      })
      .eq('creature_id', creatureId)
      .eq('season_id', seasonId);
    return true;
  }

  const currentFatigue = stats.fatigue ?? 0;
  const currentSharpness = stats.sharpness ?? 50;

  // Apply treatment effects
  let newFatigue: number;
  if (treatmentDef.fatigue_reduction === null) {
    // null = reset to 0 (Full Reset)
    newFatigue = 0;
  } else {
    newFatigue = Math.max(0, currentFatigue - treatmentDef.fatigue_reduction);
  }

  let newSharpness: number;
  if (treatmentDef.sharpness_set === null) {
    // null = unchanged (Stim Pack)
    newSharpness = currentSharpness;
  } else {
    newSharpness = treatmentDef.sharpness_set;
  }

  newFatigue = Math.round(newFatigue * 100) / 100;
  newSharpness = Math.round(newSharpness * 100) / 100;

  // Update creature_stats: apply effects + clear lockout
  const { error: updateErr } = await supabase
    .from('creature_stats')
    .update({
      fatigue: newFatigue,
      sharpness: newSharpness,
      treatment_type: null,
      treatment_started_at: null,
      treatment_ends_at: null,
      last_action_at: new Date().toISOString(),
    })
    .eq('creature_id', creatureId)
    .eq('season_id', seasonId);

  if (updateErr) {
    console.error('Treatment completion update error:', updateErr);
    return false;
  }

  // Update treatment_log with completion info
  const { error: logErr } = await supabase
    .from('treatment_log')
    .update({
      fatigue_after: newFatigue,
      sharpness_after: newSharpness,
      completed_at: new Date().toISOString(),
    })
    .eq('creature_id', creatureId)
    .eq('season_id', seasonId)
    .eq('treatment_type', stats.treatment_type)
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (logErr) {
    console.error('Treatment log completion update error:', logErr);
  }

  return true;
}
