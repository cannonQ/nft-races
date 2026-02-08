import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { getActiveSeason } from '../_lib/helpers';
import {
  validateTrainingAction,
  computeTrainingGains,
  applyConditionDecay,
  STAT_KEYS,
} from '../../lib/training-engine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { creatureId, activity, walletAddress } = req.body ?? {};

  if (!creatureId || !activity || !walletAddress) {
    return res.status(400).json({ error: 'creatureId, activity, and walletAddress are required' });
  }

  try {
    // 1. Verify creature exists and ownership
    const { data: creature, error: creatureErr } = await supabase
      .from('creatures')
      .select('id, owner_address')
      .eq('id', creatureId)
      .single();

    if (creatureErr || !creature) {
      return res.status(400).json({ error: 'Creature not found' });
    }

    if (creature.owner_address !== walletAddress) {
      return res.status(400).json({ error: 'Wallet address does not match creature owner' });
    }

    // 2. Get active season
    const season = await getActiveSeason();
    if (!season) {
      return res.status(400).json({ error: 'No active season' });
    }

    // 3. Validate training action (daily limits, cooldown, etc.)
    const validation = await validateTrainingAction(creatureId, season.id, supabase);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    // 4. Load game config
    const { data: gameConfig, error: configErr } = await supabase
      .from('game_config')
      .select('*')
      .limit(1)
      .single();

    if (configErr || !gameConfig) {
      return res.status(500).json({ error: 'Failed to load game config' });
    }

    // 5. Compute training gains
    const currentStats = validation.stats!;
    const gains = computeTrainingGains(activity, currentStats, gameConfig);

    // 6. Determine if boost is used
    const boostMultiplier = validation.statsRow?.boost_multiplier ?? 0;
    const boostUsed = boostMultiplier > 0;

    // Apply boost to stat gains
    if (boostUsed) {
      for (const key of STAT_KEYS) {
        if (gains.statChanges[key] !== undefined) {
          gains.statChanges[key] = Math.round(gains.statChanges[key]! * (1 + boostMultiplier) * 100) / 100;
        }
      }
    }

    // 7. Compute new stat values
    const newStats = { ...currentStats };
    for (const key of STAT_KEYS) {
      if (gains.statChanges[key] !== undefined) {
        newStats[key] = Math.round(Math.min(80, newStats[key] + gains.statChanges[key]!) * 100) / 100;
      }
    }

    // 8. Compute new condition values
    const rawFatigue = (validation.statsRow?.fatigue ?? 0) + gains.fatigueDelta;
    const rawSharpness = Math.min(100, (validation.statsRow?.sharpness ?? 50) + gains.sharpnessDelta);
    const fatigue = Math.min(100, Math.round(rawFatigue * 100) / 100);
    const sharpness = Math.round(rawSharpness * 100) / 100;

    const now = new Date().toISOString();

    // 9. Update creature_stats
    const { error: updateErr } = await supabase
      .from('creature_stats')
      .update({
        ...newStats,
        fatigue,
        sharpness,
        last_action_at: now,
        action_count: (validation.statsRow?.action_count ?? 0) + 1,
        // Consume boost after use (reset to 0)
        boost_multiplier: boostUsed ? 0 : boostMultiplier,
      })
      .eq('creature_id', creatureId)
      .eq('season_id', season.id);

    if (updateErr) {
      console.error('Stats update error:', updateErr);
      return res.status(500).json({ error: 'Failed to update creature stats' });
    }

    // 10. Insert training log
    const { error: logErr } = await supabase.from('training_log').insert({
      creature_id: creatureId,
      season_id: season.id,
      activity,
      stat_changes: gains.statChanges,
      fatigue_delta: gains.fatigueDelta,
      boosted: boostUsed,
    });

    if (logErr) {
      console.error('Training log insert error:', logErr);
      // Non-fatal — training already applied
    }

    // 11. Compute actions remaining
    const maxActions = 2 + (validation.statsRow?.bonus_actions ?? 0);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count: actionsToday } = await supabase
      .from('training_log')
      .select('*', { count: 'exact', head: true })
      .eq('creature_id', creatureId)
      .eq('season_id', season.id)
      .gte('created_at', todayStart.toISOString());

    const actionsRemaining = Math.max(0, maxActions - (actionsToday ?? 0));

    // 12. Compute next action cooldown
    const cooldownHours = 24 / maxActions;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const readyAt = new Date(Date.now() + cooldownMs);
    const nextActionAt = actionsRemaining > 0 ? readyAt.toISOString() : null;

    return res.status(200).json({
      success: true,
      statChanges: gains.statChanges,
      newStats,
      fatigue,
      sharpness,
      boostUsed,
      actionsRemaining,
      nextActionAt,
    });
  } catch (err) {
    console.error('POST /api/v2/train error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
