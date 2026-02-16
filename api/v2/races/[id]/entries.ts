import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';

/**
 * GET /api/v2/races/[id]/entries?wallet=ADDRESS
 * Returns creature IDs entered by this wallet in the given race.
 * Lightweight endpoint for the entry modal's "already entered" check.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const raceId = req.query.id as string;
  const wallet = req.query.wallet as string;

  if (!raceId || !wallet) {
    return res.status(400).json({ error: 'raceId and wallet query param are required' });
  }

  try {
    const { data, error } = await supabase
      .from('season_race_entries')
      .select('creature_id')
      .eq('race_id', raceId)
      .eq('owner_address', wallet);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch entries' });
    }

    return res.status(200).json({
      creatureIds: (data ?? []).map((e: any) => e.creature_id),
    });
  } catch (err) {
    console.error('GET /api/v2/races/[id]/entries error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
