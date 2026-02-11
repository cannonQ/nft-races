import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { nanoErgToErg } from '../../../_lib/constants.js';

/**
 * GET /api/v2/creatures/:id/race-history
 * Returns all race entries for a creature across all seasons, most recent first.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: 'Creature ID is required' });
  }

  try {
    // Fetch entries that have a finish position (race was resolved)
    const { data: entries, error } = await supabase
      .from('season_race_entries')
      .select('*')
      .eq('creature_id', id)
      .not('finish_position', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('race-history entries query error:', error);
      return res.status(500).json({ error: 'Failed to fetch race history' });
    }

    if (!entries || entries.length === 0) {
      return res.status(200).json([]);
    }

    // Fetch race details — query each race individually to avoid .in() issues
    const raceIds = [...new Set(entries.map((e: any) => e.race_id))];
    const raceLookup: Record<string, any> = {};

    for (const raceId of raceIds) {
      const { data: race, error: raceErr } = await supabase
        .from('season_races')
        .select('id, name, race_type, status, updated_at')
        .eq('id', raceId)
        .single();

      if (raceErr) {
        console.error(`race lookup failed for ${raceId}:`, raceErr);
        continue;
      }
      if (race) {
        raceLookup[race.id] = race;
      }
    }

    const result = entries.map((entry: any) => {
      const race = raceLookup[entry.race_id];
      return {
        raceId: entry.race_id,
        raceName: race?.name ?? 'Unknown Race',
        raceType: race?.race_type ?? 'mixed',
        date: race?.updated_at ?? entry.created_at,
        position: entry.finish_position,
        payout: nanoErgToErg(entry.payout_nanoerg ?? 0),
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/creatures/[id]/race-history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
