import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { nanoErgToErg } from '../../_lib/constants.js';

function mapSeason(data: any) {
  return {
    id: data.id,
    name: data.name,
    seasonNumber: data.season_number ?? 1,
    collectionId: data.collection_id,
    collectionName: data.collections?.name ?? null,
    modifier: data.modifier ?? { theme: '', description: '' },
    startDate: data.start_date,
    endDate: data.end_date,
    prizePool: nanoErgToErg(data.prize_pool_nanoerg ?? 0),
    prizePoolNanoerg: data.prize_pool_nanoerg ?? 0,
    status: data.status,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const collectionId = req.query.collectionId as string | undefined;

    // If collectionId specified, return single season for that collection
    if (collectionId) {
      const { data, error } = await supabase
        .from('seasons')
        .select('*, collections(name)')
        .eq('status', 'active')
        .eq('collection_id', collectionId)
        .limit(1)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'No active season for this collection' });
      }

      return res.status(200).json(mapSeason(data));
    }

    // No filter: return all active seasons
    const { data, error } = await supabase
      .from('seasons')
      .select('*, collections(name)')
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch seasons' });
    }

    const seasons = (data ?? []).map(mapSeason);

    // Backward compat: if exactly one season, return it as object
    if (seasons.length === 1) {
      return res.status(200).json(seasons[0]);
    }

    // Zero or multiple: return array
    if (seasons.length === 0) {
      return res.status(404).json({ error: 'No active season' });
    }

    return res.status(200).json(seasons);
  } catch (err) {
    console.error('GET /api/v2/seasons/current error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
