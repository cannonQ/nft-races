import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { getActiveSeason } from '../../_lib/helpers.js';
import { nanoErgToErg } from '../../_lib/constants.js';
import { resolveRace } from '../../_lib/resolve-race.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const season = await getActiveSeason();
    if (!season) {
      return res.status(200).json([]);
    }

    // Auto-resolve any expired open races with auto_resolve enabled
    const now = new Date().toISOString();
    const { data: expiredRaces } = await supabase
      .from('season_races')
      .select('id')
      .eq('season_id', season.id)
      .eq('status', 'open')
      .eq('auto_resolve', true)
      .lt('entry_deadline', now);

    if (expiredRaces && expiredRaces.length > 0) {
      for (const expired of expiredRaces) {
        try {
          const result = await resolveRace(expired.id);
          console.log(`Auto-resolved race ${expired.id}:`, result.success ? 'OK' : result.reason);
        } catch (err) {
          console.error(`Failed to auto-resolve race ${expired.id}:`, err);
        }
      }
    }

    // Fetch open/upcoming races and recently resolved races
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [openResult, resolvedResult, cancelledResult] = await Promise.all([
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
      supabase
        .from('season_races')
        .select('*, season_race_entries(count)')
        .eq('season_id', season.id)
        .eq('status', 'cancelled')
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
        autoResolve: race.auto_resolve ?? true,
      };
    }

    const openRaces = (openResult.data ?? []).map(mapRace);
    const resolvedRaces = (resolvedResult.data ?? []).map(mapRace);
    const cancelledRaces = (cancelledResult.data ?? []).map(mapRace);

    return res.status(200).json([...openRaces, ...resolvedRaces, ...cancelledRaces]);
  } catch (err) {
    console.error('GET /api/v2/races error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
