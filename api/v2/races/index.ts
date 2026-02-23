import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { getActiveSeasons, getActiveSeason } from '../../_lib/helpers.js';
import { nanoErgToErg } from '../../_lib/constants.js';
import { resolveRace } from '../../_lib/resolve-race.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    // Optional collection filter
    const collectionIdFilter = req.query.collectionId as string | undefined;

    // Fetch active seasons (one per collection, or filtered to one)
    let seasons: any[];
    if (collectionIdFilter) {
      const s = await getActiveSeason(collectionIdFilter);
      seasons = s ? [s] : [];
    } else {
      seasons = await getActiveSeasons();
    }

    if (seasons.length === 0) {
      return res.status(200).json([]);
    }

    // Build lookup: seasonId → { collectionId, collectionName }
    const seasonIds = seasons.map((s: any) => s.id);
    const seasonMap = new Map<string, { collectionId: string; collectionName: string }>();
    for (const s of seasons) {
      seasonMap.set(s.id, {
        collectionId: s.collection_id,
        collectionName: s.collections?.name ?? 'Unknown',
      });
    }

    // Auto-resolve expired open races with auto_resolve enabled (across all active seasons).
    // A4-3: Limit to 3 per page load to avoid long request times / timeouts.
    const now = new Date().toISOString();
    const { data: expiredRaces } = await supabase
      .from('season_races')
      .select('id')
      .in('season_id', seasonIds)
      .eq('status', 'open')
      .eq('auto_resolve', true)
      .lt('entry_deadline', now)
      .order('entry_deadline', { ascending: true })
      .limit(3);

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

    // Fetch open/upcoming races and recently resolved races across all active seasons
    const [openResult, resolvedResult, cancelledResult] = await Promise.all([
      supabase
        .from('season_races')
        .select('*, season_race_entries(count)')
        .in('season_id', seasonIds)
        .in('status', ['open', 'upcoming'])
        .order('entry_deadline', { ascending: true }),
      supabase
        .from('season_races')
        .select('*, season_race_entries(count)')
        .in('season_id', seasonIds)
        .in('status', ['resolved', 'locked'])
        .order('entry_deadline', { ascending: false })
        .limit(100),
      supabase
        .from('season_races')
        .select('*, season_race_entries(count)')
        .in('season_id', seasonIds)
        .eq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    function mapRace(race: any) {
      const seasonInfo = seasonMap.get(race.season_id);
      return {
        id: race.id,
        name: race.name,
        raceType: race.race_type,
        entryFee: nanoErgToErg(race.entry_fee_nanoerg ?? 0),
        entryFeeToken: race.entry_fee_token ?? null,
        maxEntries: race.max_entries,
        entryCount: race.season_race_entries?.[0]?.count ?? 0,
        entryDeadline: race.entry_deadline,
        status: race.status,
        autoResolve: race.auto_resolve ?? true,
        rarityClass: race.rarity_class ?? null,
        classWeight: race.class_weight ?? 1.0,
        collectionId: seasonInfo?.collectionId ?? race.collection_id ?? null,
        collectionName: seasonInfo?.collectionName ?? null,
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
