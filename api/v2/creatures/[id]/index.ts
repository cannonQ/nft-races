import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase';
import { getActiveSeason, countActionsToday, computeCreatureResponse } from '../../../_lib/helpers';

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

    // Fetch stats and prestige in parallel
    const [statsResult, prestigeResult] = await Promise.all([
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
    ]);

    const actionsToday = season && statsResult.data
      ? await countActionsToday(id, season.id)
      : 0;

    const result = computeCreatureResponse(
      creature,
      statsResult.data ?? null,
      prestigeResult.data ?? null,
      actionsToday,
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/creatures/[id] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
