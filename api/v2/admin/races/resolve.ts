import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { getLatestErgoBlock } from '../../../_lib/helpers.js';
import { nanoErgToErg, positionToRewardLabel } from '../../../_lib/constants.js';
import {
  computeRaceResult,
  applyRaceRewards,
  applyConditionDecay,
  STAT_KEYS,
} from '../../../../lib/training-engine.js';
import type { RaceEntry } from '../../../../lib/training-engine.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!requireAdmin(req, res)) return;

  const { raceId } = req.body ?? {};
  if (!raceId) {
    return res.status(400).json({ error: 'raceId is required' });
  }

  try {
    // 1. Fetch race
    const { data: race, error: raceErr } = await supabase
      .from('season_races')
      .select('*')
      .eq('id', raceId)
      .single();

    if (raceErr || !race) {
      return res.status(404).json({ error: 'Race not found' });
    }

    if (race.status === 'resolved') {
      return res.status(400).json({ error: 'Race is already resolved' });
    }

    if (race.status !== 'open' && race.status !== 'locked') {
      return res.status(400).json({ error: `Cannot resolve race with status: ${race.status}` });
    }

    // 2. Lock the race to prevent new entries
    await supabase
      .from('season_races')
      .update({ status: 'locked' })
      .eq('id', raceId);

    // 3. Fetch all entries with creature data
    const { data: entries, error: entriesErr } = await supabase
      .from('season_race_entries')
      .select('*, creatures(id, base_stats)')
      .eq('race_id', raceId);

    if (entriesErr || !entries || entries.length === 0) {
      // No entries — cancel the race
      await supabase
        .from('season_races')
        .update({ status: 'cancelled' })
        .eq('id', raceId);
      return res.status(200).json({ success: true, cancelled: true, reason: 'No entries' });
    }

    // Need at least 2 entries for a race
    if (entries.length < 2) {
      await supabase
        .from('season_races')
        .update({ status: 'cancelled' })
        .eq('id', raceId);
      return res.status(200).json({ success: true, cancelled: true, reason: 'Fewer than 2 entries' });
    }

    // 4. Load game_config for race type weights
    const { data: gameConfig, error: configErr } = await supabase
      .from('game_config')
      .select('*')
      .limit(1)
      .single();

    if (configErr || !gameConfig) {
      return res.status(500).json({ error: 'Failed to load game config' });
    }

    // 5. Fetch latest Ergo block for deterministic RNG + boost expiry
    const { hash: blockHash, height: blockHeight } = await getLatestErgoBlock();

    // 6. Build race entries with snapshot data
    const raceEntries: RaceEntry[] = entries.map((entry: any) => {
      const baseStats = entry.snapshot_base_stats || entry.creatures?.base_stats || {};
      const trainedStats = entry.snapshot_stats || {};

      return {
        creatureId: entry.creature_id,
        baseStats: {
          speed: baseStats.speed ?? 0,
          stamina: baseStats.stamina ?? 0,
          accel: baseStats.accel ?? 0,
          agility: baseStats.agility ?? 0,
          heart: baseStats.heart ?? 0,
          focus: baseStats.focus ?? 0,
        },
        trainedStats: {
          speed: trainedStats.speed ?? 0,
          stamina: trainedStats.stamina ?? 0,
          accel: trainedStats.accel ?? 0,
          agility: trainedStats.agility ?? 0,
          heart: trainedStats.heart ?? 0,
          focus: trainedStats.focus ?? 0,
        },
        fatigue: entry.snapshot_fatigue ?? 0,
        sharpness: entry.snapshot_sharpness ?? 50,
      };
    });

    // 7. Compute race results
    const raceResult = computeRaceResult(raceEntries, race.race_type, blockHash, gameConfig.config);

    // 8. Compute prize payouts from entry fees
    const entryFee = race.entry_fee_nanoerg ?? 0;
    const totalPool = entryFee * entries.length;
    const prizeDistribution: number[] = gameConfig.config?.prize_distribution ?? [0.50, 0.30, 0.20];

    // 9. Update each entry with results
    for (const result of raceResult.results) {
      // Find the original entry row
      const entryRow = entries.find((e: any) => e.creature_id === result.creatureId);
      if (!entryRow) continue;

      // Compute payout
      let payoutNanoerg = 0;
      if (result.position <= prizeDistribution.length && totalPool > 0) {
        payoutNanoerg = Math.floor(totalPool * prizeDistribution[result.position - 1]);
      }

      await supabase
        .from('season_race_entries')
        .update({
          finish_position: result.position,
          performance_score: result.performanceScore,
          payout_nanoerg: payoutNanoerg,
        })
        .eq('id', entryRow.id);
    }

    // 10. Apply race reward boosts (bonus actions, discrete boost rewards)
    await applyRaceRewards(raceResult.results, race.season_id, raceId, blockHeight, supabase);

    // 11. Update season_leaderboard for each participant
    for (const result of raceResult.results) {
      const entryRow = entries.find((e: any) => e.creature_id === result.creatureId);
      if (!entryRow) continue;

      const payoutNanoerg = result.position <= prizeDistribution.length && totalPool > 0
        ? Math.floor(totalPool * prizeDistribution[result.position - 1])
        : 0;

      // Upsert leaderboard entry
      const { data: existing } = await supabase
        .from('season_leaderboard')
        .select('*')
        .eq('season_id', race.season_id)
        .eq('creature_id', result.creatureId)
        .single();

      if (existing) {
        await supabase
          .from('season_leaderboard')
          .update({
            wins: (existing.wins ?? 0) + (result.position === 1 ? 1 : 0),
            places: (existing.places ?? 0) + (result.position === 2 ? 1 : 0),
            shows: (existing.shows ?? 0) + (result.position === 3 ? 1 : 0),
            races_entered: (existing.races_entered ?? 0) + 1,
            total_earnings_nanoerg: (existing.total_earnings_nanoerg ?? 0) + payoutNanoerg,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('season_leaderboard').insert({
          season_id: race.season_id,
          creature_id: result.creatureId,
          owner_address: entryRow.owner_address,
          wins: result.position === 1 ? 1 : 0,
          places: result.position === 2 ? 1 : 0,
          shows: result.position === 3 ? 1 : 0,
          races_entered: 1,
          total_earnings_nanoerg: payoutNanoerg,
        });
      }
    }

    // 12. Mark race as resolved
    const { error: resolveErr } = await supabase
      .from('season_races')
      .update({
        status: 'resolved',
        block_hash: blockHash,
      })
      .eq('id', raceId);

    if (resolveErr) {
      console.error('Failed to mark race as resolved:', resolveErr);
    }

    // 13. Build response
    const resultsSummary = raceResult.results.map(r => {
      const entryRow = entries.find((e: any) => e.creature_id === r.creatureId);
      const payoutNanoerg = r.position <= prizeDistribution.length && totalPool > 0
        ? Math.floor(totalPool * prizeDistribution[r.position - 1])
        : 0;

      return {
        position: r.position,
        creatureId: r.creatureId,
        ownerAddress: entryRow?.owner_address,
        performanceScore: r.performanceScore,
        payout: nanoErgToErg(payoutNanoerg),
        reward: positionToRewardLabel(r.position),
      };
    });

    return res.status(200).json({
      success: true,
      raceId,
      blockHash,
      totalPool: nanoErgToErg(totalPool),
      results: resultsSummary,
    });
  } catch (err) {
    console.error('POST /api/v2/admin/races/resolve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
