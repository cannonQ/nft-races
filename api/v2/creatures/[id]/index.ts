import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { getActiveSeason, getLatestErgoBlock, countRegularActionsToday, computeCreatureResponse } from '../../../_lib/helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: 'Creature ID is required' });
  }

  try {
    // Fetch creature
    const { data: creature, error: creatureErr } = await supabase
      .from('creatures')
      .select('*')
      .eq('id', id)
      .single();

    if (creatureErr || !creature) {
      return res.status(404).json({ error: 'Creature not found' });
    }

    const season = await getActiveSeason();

    // Fetch stats, prestige, and current season leaderboard in parallel
    const [statsResult, prestigeResult, leaderboardResult] = await Promise.all([
      season
        ? supabase
            .from('creature_stats')
            .select('*')
            .eq('creature_id', id)
            .eq('season_id', season.id)
            .single()
        : { data: null },
      supabase
        .from('prestige')
        .select('*')
        .eq('creature_id', id)
        .single(),
      season
        ? supabase
            .from('season_leaderboard')
            .select('*')
            .eq('creature_id', id)
            .eq('season_id', season.id)
            .single()
        : { data: null },
    ]);

    const regularActionsToday = season && statsResult.data
      ? await countRegularActionsToday(id, season.id)
      : 0;

    // Fetch available (unspent + unexpired) boost rewards
    let availableBoosts: any[] = [];
    if (season) {
      const { height: currentHeight } = await getLatestErgoBlock();
      const { data: boostRows } = await supabase
        .from('boost_rewards')
        .select('*')
        .eq('creature_id', id)
        .eq('season_id', season.id)
        .is('spent_at', null)
        .gt('expires_at_height', currentHeight);
      availableBoosts = boostRows ?? [];
    }

    const result = computeCreatureResponse(
      creature,
      statsResult.data ?? null,
      prestigeResult.data ?? null,
      regularActionsToday,
      availableBoosts,
      leaderboardResult.data ?? null,
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/creatures/[id] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
