import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { nanoErgToErg } from '../../_lib/constants.js';

/**
 * GET /api/v2/seasons
 * Public listing of all seasons (active + completed).
 * Optional query params:
 *   ?status=active|completed  — filter by status
 *   ?collectionId=UUID        — filter by collection
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const status = req.query.status as string | undefined;
    const collectionId = req.query.collectionId as string | undefined;

    let query = supabase
      .from('seasons')
      .select('*, collections(name)')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    } else {
      // Exclude upcoming by default — only show active + completed
      query = query.in('status', ['active', 'completed']);
    }

    if (collectionId) {
      query = query.eq('collection_id', collectionId);
    }

    const { data: seasons, error } = await query;

    if (error) {
      console.error('GET /api/v2/seasons error:', error);
      return res.status(500).json({ error: 'Failed to fetch seasons' });
    }

    const mapped = (seasons ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      seasonNumber: s.season_number,
      collectionId: s.collection_id,
      collectionName: s.collections?.name ?? null,
      status: s.status,
      modifier: s.modifier ?? { theme: '', description: '' },
      prizePool: nanoErgToErg(s.prize_pool_nanoerg ?? 0),
      prizePoolNanoerg: s.prize_pool_nanoerg ?? 0,
      startDate: s.start_date,
      endDate: s.end_date,
      createdAt: s.created_at,
    }));

    return res.status(200).json(mapped);
  } catch (err) {
    console.error('GET /api/v2/seasons error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
