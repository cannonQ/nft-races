import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';
import { getActiveSeason } from '../../_lib/helpers';
import { nanoErgToErg } from '../../_lib/constants';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const season = await getActiveSeason();
    if (!season) {
      return res.status(200).json([]);
    }

    // Fetch open/upcoming races and recently resolved races (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [openResult, resolvedResult] = await Promise.all([
      supabase
        .from('season_races')
        .select('*, season_race_entries(count)')
        .eq('season_id', season.id)
        .in('status', ['open', 'upcoming'])
        .order('entry_deadline', { ascending: true }),
      supabase
        .from('season_races')
        .select('*, season_race_entries(count)')
        .eq('season_id', season.id)
        .in('status', ['resolved', 'locked'])
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    function mapRace(race: any) {
      return {
        id: race.id,
        name: race.name,
        raceType: race.race_type,
        entryFee: nanoErgToErg(race.entry_fee_nanoerg ?? 0),
        maxEntries: race.max_entries,
        entryCount: race.season_race_entries?.[0]?.count ?? 0,
        entryDeadline: race.entry_deadline,
        status: race.status,
      };
    }

    const openRaces = (openResult.data ?? []).map(mapRace);
    const resolvedRaces = (resolvedResult.data ?? []).map(mapRace);

    return res.status(200).json([...openRaces, ...resolvedRaces]);
  } catch (err) {
    console.error('GET /api/v2/races error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
