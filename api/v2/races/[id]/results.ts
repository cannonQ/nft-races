import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';
import seedrandom from 'seedrandom';
import { supabase } from '../../../_lib/supabase';
import { nanoErgToErg, positionToRewardLabel } from '../../../_lib/constants';
import { getCreatureDisplayName } from '../../../_lib/helpers';
import { STAT_KEYS } from '../../../../lib/training-engine';
import type { StatName } from '../../../../lib/training-engine';

function seedToFloat(hexSeed: string): number {
  const rng = seedrandom(hexSeed);
  return rng() * 2 - 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: 'Race ID is required' });
  }

  try {
    // Fetch race
    const { data: race, error: raceErr } = await supabase
      .from('season_races')
      .select('*')
      .eq('id', id)
      .single();

    if (raceErr || !race) {
      return res.status(404).json({ error: 'Race not found' });
    }

    // Fetch entries with creature details, ordered by finish position
    const { data: entries, error: entriesErr } = await supabase
      .from('season_race_entries')
      .select('*, creatures(name, rarity, metadata)')
      .eq('race_id', id)
      .order('finish_position', { ascending: true });

    if (entriesErr) {
      return res.status(500).json({ error: 'Failed to fetch race entries' });
    }

    // Load game_config to get race type weights for breakdown
    const { data: gameConfig } = await supabase
      .from('game_config')
      .select('*')
      .limit(1)
      .single();

    const raceTypeWeights: Record<string, number> =
      gameConfig?.config?.race_type_weights?.[race.race_type] ?? {};

    const totalPrizePool = (entries ?? []).reduce(
      (sum: number, e: any) => sum + (e.payout_nanoerg ?? 0),
      0,
    );

    const mappedEntries = (entries ?? []).map((entry: any) => {
      // Build breakdown from snapshot data if available
      let breakdown = null;
      if (entry.snapshot_stats && entry.snapshot_base_stats) {
        const base = entry.snapshot_base_stats;
        const trained = entry.snapshot_stats;
        const effectiveStats: Record<string, number> = {};
        for (const key of STAT_KEYS) {
          effectiveStats[key] = (base[key] ?? 0) + (trained[key] ?? 0);
        }

        // Weighted score from race type weights
        const weightedScore = STAT_KEYS.reduce(
          (sum, key) => sum + (effectiveStats[key] ?? 0) * (raceTypeWeights[key] ?? 0),
          0,
        );

        // Condition modifiers
        const fatigue = entry.snapshot_fatigue ?? 0;
        const sharpness = entry.snapshot_sharpness ?? 50;
        const fatigueMod = 1.0 - fatigue / 200;
        const sharpnessMod = 0.90 + sharpness / 1000;

        // Recompute RNG modifier from block hash (deterministic)
        let rngMod = 0;
        if (race.block_hash) {
          const rngSeed = createHash('sha256')
            .update(race.block_hash + entry.creature_id)
            .digest('hex');
          const rngValue = seedToFloat(rngSeed);
          const focusSwing = 0.30 * (1 - effectiveStats.focus / (80 + (base.focus ?? 0)));
          rngMod = rngValue * focusSwing;
        }

        breakdown = {
          effectiveStats,
          raceTypeWeights,
          weightedScore: Math.round(weightedScore * 1000) / 1000,
          fatigue,
          sharpness,
          fatigueMod: Math.round(fatigueMod * 1000) / 1000,
          sharpnessMod: Math.round(sharpnessMod * 1000) / 1000,
          rngMod: Math.round(rngMod * 10000) / 10000,
          finalScore: entry.performance_score ?? 0,
        };
      }

      return {
        position: entry.finish_position,
        creatureId: entry.creature_id,
        creatureName: getCreatureDisplayName(entry.creatures?.metadata, entry.creatures?.name ?? 'Unknown'),
        rarity: entry.creatures?.rarity ?? 'common',
        ownerId: entry.owner_address,
        ownerAddress: entry.owner_address,
        performanceScore: entry.performance_score ?? 0,
        payout: nanoErgToErg(entry.payout_nanoerg ?? 0),
        reward: positionToRewardLabel(entry.finish_position ?? 99),
        breakdown,
      };
    });

    return res.status(200).json({
      race: {
        id: race.id,
        name: race.name,
        raceType: race.race_type,
        entryFee: nanoErgToErg(race.entry_fee_nanoerg ?? 0),
        maxEntries: race.max_entries,
        entryCount: mappedEntries.length,
        entryDeadline: race.entry_deadline,
        status: race.status,
        totalEntrants: mappedEntries.length,
        totalPrizePool: nanoErgToErg(totalPrizePool),
        completedAt: race.updated_at ?? race.created_at,
      },
      entries: mappedEntries,
    });
  } catch (err) {
    console.error('GET /api/v2/races/[id]/results error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
