import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase';
import { nanoErgToErg, positionToRewardLabel } from '../../../_lib/constants';

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
      .select('*, creatures(name, rarity)')
      .eq('race_id', id)
      .order('finish_position', { ascending: true });

    if (entriesErr) {
      return res.status(500).json({ error: 'Failed to fetch race entries' });
    }

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
        const effectiveStats = {
          speed: (base.speed ?? 0) + (trained.speed ?? 0),
          stamina: (base.stamina ?? 0) + (trained.stamina ?? 0),
          accel: (base.accel ?? 0) + (trained.accel ?? 0),
          agility: (base.agility ?? 0) + (trained.agility ?? 0),
          heart: (base.heart ?? 0) + (trained.heart ?? 0),
          focus: (base.focus ?? 0) + (trained.focus ?? 0),
        };
        const fatigueMod = 1.0 - (entry.snapshot_fatigue ?? 0) / 200;
        const sharpnessMod = 0.90 + (entry.snapshot_sharpness ?? 0) / 1000;

        breakdown = {
          effectiveStats,
          weightedScore: 0, // Would need race_type_weights to compute
          fatigueMod: Math.round(fatigueMod * 1000) / 1000,
          sharpnessMod: Math.round(sharpnessMod * 1000) / 1000,
          rngMod: 0, // Stored in performance_score implicitly
          finalScore: entry.performance_score ?? 0,
        };
      }

      return {
        position: entry.finish_position,
        creatureId: entry.creature_id,
        creatureName: entry.creatures?.name ?? 'Unknown',
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
        completedAt: race.updated_at,
      },
      entries: mappedEntries,
    });
  } catch (err) {
    console.error('GET /api/v2/races/[id]/results error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
