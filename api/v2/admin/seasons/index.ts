import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { nanoErgToErg } from '../../../_lib/constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const { data: seasons, error } = await supabase
      .from('seasons')
      .select('*, collections(name)')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch seasons' });
    }

    const mapped = (seasons ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      seasonNumber: s.season_number,
      collectionId: s.collection_id,
      collectionName: s.collections?.name ?? null,
      status: s.status,
      modifier: s.modifier,
      prizePool: nanoErgToErg(s.prize_pool_nanoerg ?? 0),
      prizePoolNanoerg: s.prize_pool_nanoerg ?? 0,
      startDate: s.start_date,
      endDate: s.end_date,
      createdAt: s.created_at,
    }));

    return res.status(200).json(mapped);
  } catch (err) {
    console.error('GET /api/v2/admin/seasons error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
