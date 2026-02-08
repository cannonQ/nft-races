import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase';
import { getActiveSeason, getUtcMidnightToday, computeCreatureResponse } from '../../../_lib/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const address = req.query.address as string;
  if (!address) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    const season = await getActiveSeason();

    // Fetch all creatures for this wallet
    const { data: creatures, error: creaturesErr } = await supabase
      .from('creatures')
      .select('*')
      .eq('owner_address', address);

    if (creaturesErr) {
      return res.status(500).json({ error: 'Failed to fetch creatures' });
    }

    if (!creatures || creatures.length === 0) {
      return res.status(200).json([]);
    }

    const creatureIds = creatures.map((c: any) => c.id);

    // Batch fetch creature_stats, prestige, and today's training logs
    const [statsResult, prestigeResult, logsResult] = await Promise.all([
      season
        ? supabase
            .from('creature_stats')
            .select('*')
            .eq('season_id', season.id)
            .in('creature_id', creatureIds)
        : { data: [] },
      supabase
        .from('prestige')
        .select('*')
        .in('creature_id', creatureIds),
      season
        ? supabase
            .from('training_log')
            .select('creature_id')
            .in('creature_id', creatureIds)
            .eq('season_id', season.id)
            .gte('created_at', getUtcMidnightToday())
        : { data: [] },
    ]);

    // Build lookup maps
    const statsMap = new Map<string, any>();
    for (const s of (statsResult.data ?? [])) {
      statsMap.set(s.creature_id, s);
    }

    const prestigeMap = new Map<string, any>();
    for (const p of (prestigeResult.data ?? [])) {
      prestigeMap.set(p.creature_id, p);
    }

    // Count today's actions per creature
    const actionCountMap = new Map<string, number>();
    for (const log of (logsResult.data ?? [])) {
      const current = actionCountMap.get(log.creature_id) ?? 0;
      actionCountMap.set(log.creature_id, current + 1);
    }

    // Assemble responses
    const result = creatures.map((creature: any) => {
      const stats = statsMap.get(creature.id) ?? null;
      const prestige = prestigeMap.get(creature.id) ?? null;
      const actionsToday = actionCountMap.get(creature.id) ?? 0;
      return computeCreatureResponse(creature, stats, prestige, actionsToday);
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/creatures/by-wallet error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
