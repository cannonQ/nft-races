import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { getActiveSeason } from '../../../_lib/helpers.js';
import { ACTIVITY_DISPLAY } from '../../../_lib/constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: 'Creature ID is required' });
  }

  try {
    const season = await getActiveSeason();
    if (!season) {
      return res.status(404).json({ error: 'No active season' });
    }

    const { data: logs, error } = await supabase
      .from('training_log')
      .select('*')
      .eq('creature_id', id)
      .eq('season_id', season.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch training log' });
    }

    const result = (logs ?? []).map((log: any) => {
      const display = ACTIVITY_DISPLAY[log.activity] ?? {
        name: log.activity,
        icon: 'Activity',
        primaryStat: 'speed',
      };

      return {
        id: log.id,
        activity: log.activity,
        activityName: display.name,
        activityIcon: display.icon,
        primaryStat: display.primaryStat,
        statChanges: log.stat_changes ?? {},
        fatigueDelta: log.fatigue_change ?? 0,
        wasBoosted: log.boosted ?? false,
        createdAt: log.created_at,
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/creatures/[id]/training-log error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
