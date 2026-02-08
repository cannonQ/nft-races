import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { getActiveSeason } from '../_lib/helpers';
import { nanoErgToErg } from '../_lib/constants';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    let seasonId = req.query.season as string | undefined;

    // Default to active season if none specified
    if (!seasonId) {
      const season = await getActiveSeason();
      if (!season) {
        return res.status(404).json({ error: 'No active season' });
      }
      seasonId = season.id;
    }

    const { data, error } = await supabase
      .from('season_leaderboard')
      .select('*, creatures(name, token_id, rarity)')
      .eq('season_id', seasonId)
      .order('wins', { ascending: false })
      .order('places', { ascending: false })
      .order('shows', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }

    const result = (data ?? []).map((row: any, index: number) => ({
      rank: index + 1,
      creatureId: row.creature_id,
      creatureName: row.creatures?.name ?? 'Unknown',
      tokenId: row.creatures?.token_id ?? '',
      rarity: row.creatures?.rarity ?? 'common',
      ownerAddress: row.owner_address,
      wins: row.wins ?? 0,
      places: row.places ?? 0,
      shows: row.shows ?? 0,
      racesEntered: row.races_entered ?? 0,
      earnings: nanoErgToErg(row.total_earnings_nanoerg ?? 0),
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
