import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { nanoErgToErg } from '../../_lib/constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const { data, error } = await supabase
      .from('seasons')
      .select('*, collections(name)')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'No active season' });
    }

    return res.status(200).json({
      id: data.id,
      name: data.name,
      seasonNumber: data.season_number ?? 1,
      collectionName: data.collections?.name ?? null,
      modifier: data.modifier ?? { theme: '', description: '' },
      startDate: data.start_date,
      endDate: data.end_date,
      prizePool: nanoErgToErg(data.prize_pool_nanoerg ?? 0),
      status: data.status,
    });
  } catch (err) {
    console.error('GET /api/v2/seasons/current error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
