import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { getActiveSeason, getCreatureDisplayName, getCreatureImageUrl } from '../_lib/helpers.js';
import { nanoErgToErg } from '../_lib/constants.js';

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
      .select('*, creatures(name, token_id, rarity, metadata)')
      .eq('season_id', seasonId)
      .order('wins', { ascending: false })
      .order('places', { ascending: false })
      .order('shows', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }

    // Compute average scores from race entries
    const creatureIds = (data ?? []).map((r: any) => r.creature_id);
    let avgScores: Record<string, number> = {};
    if (creatureIds.length > 0) {
      const { data: entries } = await supabase
        .from('season_race_entries')
        .select('creature_id, performance_score')
        .in('creature_id', creatureIds)
        .not('performance_score', 'is', null);
      if (entries) {
        const totals: Record<string, { sum: number; count: number }> = {};
        for (const e of entries) {
          if (!totals[e.creature_id]) totals[e.creature_id] = { sum: 0, count: 0 };
          totals[e.creature_id].sum += e.performance_score ?? 0;
          totals[e.creature_id].count += 1;
        }
        for (const [id, { sum, count }] of Object.entries(totals)) {
          avgScores[id] = Math.round((sum / count) * 100) / 100;
        }
      }
    }

    const result = (data ?? []).map((row: any, index: number) => ({
      rank: index + 1,
      creatureId: row.creature_id,
      creatureName: getCreatureDisplayName(row.creatures?.metadata, row.creatures?.name ?? 'Unknown'),
      tokenId: row.creatures?.token_id ?? '',
      rarity: row.creatures?.rarity ?? 'common',
      imageUrl: getCreatureImageUrl(row.creatures?.metadata),
      ownerAddress: row.owner_address,
      wins: row.wins ?? 0,
      places: row.places ?? 0,
      shows: row.shows ?? 0,
      racesEntered: row.races_entered ?? 0,
      avgScore: avgScores[row.creature_id] ?? 0,
      earnings: nanoErgToErg(row.total_earnings_nanoerg ?? 0),
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
