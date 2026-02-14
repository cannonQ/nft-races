import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { getActiveSeason, getLatestErgoBlock, getOrCreateCreatureStats } from '../_lib/helpers.js';
import { getGameConfig } from '../_lib/config.js';
import {
  validateTrainingAction,
  computeTrainingGains,
  applyConditionDecay,
  STAT_KEYS,
} from '../../lib/training-engine.js';
import { verifyNFTOwnership } from '../../lib/ergo/server.js';
import { recordLedgerEntry } from '../_lib/credit-ledger.js';
import { TRAINING_FEE_NANOERG } from '../_lib/constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { creatureId, activity, walletAddress, boostRewardIds } = req.body ?? {};

  if (!creatureId || !activity || !walletAddress) {
    return res.status(400).json({ error: 'creatureId, activity, and walletAddress are required' });
  }

  try {
    // 1. Verify creature exists (include collection_id for config resolution)
    const { data: creature, error: creatureErr } = await supabase
      .from('creatures')
      .select('id, owner_address, token_id, collection_id')
      .eq('id', creatureId)
      .single();

    if (creatureErr || !creature) {
      return res.status(400).json({ error: 'Creature not found' });
    }

    // 2. Verify on-chain NFT ownership (prevents stale DB ownership)
    const ownership = await verifyNFTOwnership(walletAddress, creature.token_id);
    if (!ownership.ownsToken) {
      // Update DB if ownership changed
      if (creature.owner_address === walletAddress) {
        await supabase
          .from('creatures')
          .update({ owner_address: null })
          .eq('id', creatureId);
      }
      return res.status(403).json({ error: 'You no longer own this NFT on-chain' });
    }

    // Update DB owner if it changed (e.g. NFT was received from another wallet)
    if (creature.owner_address !== walletAddress) {
      await supabase
        .from('creatures')
        .update({ owner_address: walletAddress })
        .eq('id', creatureId);
    }

    // 2. Get active season for this creature's collection
    const season = await getActiveSeason(creature.collection_id);
    if (!season) {
      return res.status(400).json({ error: 'No active season for this collection' });
    }

    // 3. Load merged game config (global + collection overrides)
    const mergedConfig = await getGameConfig(creature.collection_id);
    if (!mergedConfig) {
      return res.status(500).json({ error: 'Failed to load game config' });
    }

    // 4. Ensure creature has stats for this season (lazy init)
    const creatureStats = await getOrCreateCreatureStats(creatureId, season.id);
    if (!creatureStats) {
      return res.status(400).json({ error: 'Failed to load creature stats for this season' });
    }

    // 5. Validate training action (daily limits, cooldown — uses config for caps)
    const validation = await validateTrainingAction(creatureId, season.id, supabase, mergedConfig);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    // 6. Compute training gains
    const currentStats = validation.stats!;
    const gains = computeTrainingGains(activity, currentStats, mergedConfig);

    // 7. Validate + apply discrete boost rewards (if any selected)
    const selectedBoostIds: string[] = Array.isArray(boostRewardIds) ? boostRewardIds : [];
    let totalBoostMultiplier = 0;
    let boostUsed = false;
    let validatedBoosts: any[] = [];

    if (selectedBoostIds.length > 0) {
      // Fetch selected boosts — must belong to this creature, be unspent
      const { data: boostRows, error: boostErr } = await supabase
        .from('boost_rewards')
        .select('*')
        .in('id', selectedBoostIds)
        .eq('creature_id', creatureId)
        .is('spent_at', null);

      if (boostErr || !boostRows || boostRows.length !== selectedBoostIds.length) {
        return res.status(400).json({ error: 'One or more selected boosts are invalid, already spent, or do not belong to this creature' });
      }

      // Verify none are expired (need current block height)
      const { height: currentHeight } = await getLatestErgoBlock();
      const expired = boostRows.filter(b => b.expires_at_height <= currentHeight);
      if (expired.length > 0) {
        return res.status(400).json({ error: `${expired.length} selected boost(s) have expired` });
      }

      validatedBoosts = boostRows;
      totalBoostMultiplier = boostRows.reduce((sum: number, b: any) => sum + Number(b.multiplier), 0);
      boostUsed = true;

      // Apply boost to stat gains
      for (const key of STAT_KEYS) {
        if (gains.statChanges[key] !== undefined) {
          gains.statChanges[key] = Math.round(gains.statChanges[key]! * (1 + totalBoostMultiplier) * 100) / 100;
        }
      }
    }

    // 8. Compute new stat values
    const perStatCap = mergedConfig.per_stat_cap ?? 80;
    const newStats = { ...currentStats };
    for (const key of STAT_KEYS) {
      if (gains.statChanges[key] !== undefined) {
        newStats[key] = Math.round(Math.min(perStatCap, newStats[key] + gains.statChanges[key]!) * 100) / 100;
      }
    }

    // 8. Compute new condition values
    const rawFatigue = (validation.statsRow?.fatigue ?? 0) + gains.fatigueDelta;
    const rawSharpness = Math.min(100, (validation.statsRow?.sharpness ?? 50) + gains.sharpnessDelta);
    const fatigue = Math.min(100, Math.round(rawFatigue * 100) / 100);
    const sharpness = Math.round(rawSharpness * 100) / 100;

    const now = new Date().toISOString();

    // 9. Determine if this is a bonus action (bonus consumed first)
    const isBonusAction = validation.isBonusAction ?? false;
    const currentBonusActions = validation.statsRow?.bonus_actions ?? 0;

    // 10. Insert training log FIRST (before stats update).
    //     If the log insert fails, stats remain unchanged — no orphaned cooldown state.
    //     Use .select('id').single() to capture log ID for linking spent boosts.
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
      return res.status(500).json({ error: 'Failed to record training action' });
    }

    // 10b. Mark selected boosts as spent (link to this training log)
    if (validatedBoosts.length > 0) {
      const now = new Date().toISOString();
      const { error: spendErr } = await supabase
        .from('boost_rewards')
        .update({ spent_at: now, spent_in_training_log_id: logRow.id })
        .in('id', validatedBoosts.map((b: any) => b.id));

      if (spendErr) {
        console.error('Failed to mark boosts as spent:', spendErr);
        // Non-fatal — boosts were validated, training is committed
      }
    }

    // 10c. Shadow billing: record training fee (fire-and-forget)
    recordLedgerEntry({
      ownerAddress: walletAddress,
      txType: 'training_fee',
      amountNanoerg: -TRAINING_FEE_NANOERG,
      creatureId,
      seasonId: season.id,
      trainingLogId: logRow.id,
      memo: `Training: ${activity}`,
    });

    // 11. Update creature_stats (only after log is safely persisted)
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
        // Decrement bonus_actions when a bonus action is consumed
        bonus_actions: newBonusActions,
      })
      .eq('creature_id', creatureId)
      .eq('season_id', season.id);

    if (updateErr) {
      console.error('Stats update error:', updateErr);
      return res.status(500).json({ error: 'Failed to update creature stats' });
    }

    // 13. Compute actions remaining
    //     Bonus actions (remaining after this one) + regular actions left today.
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

    // 13. Compute next action cooldown
    //     Bonus actions bypass cooldown — if bonus remaining, ready immediately
    const nextIsBonusAction = newBonusActions > 0;
    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
    const readyAt = nextIsBonusAction ? new Date() : new Date(Date.now() + cooldownMs);
    const nextActionAt = actionsRemaining > 0 ? readyAt.toISOString() : null;

    return res.status(200).json({
      success: true,
      statChanges: gains.statChanges,
      newStats,
      fatigue,
      sharpness,
      boostUsed,
      totalBoostMultiplier,
      boostsConsumed: validatedBoosts.map((b: any) => b.id),
      actionsRemaining,
      nextActionAt,
    });
  } catch (err) {
    console.error('POST /api/v2/train error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
