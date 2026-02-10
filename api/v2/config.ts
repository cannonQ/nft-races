import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';

/**
 * GET /api/v2/config
 * Returns public game configuration: activity definitions and race type weights.
 * Used by frontend to show accurate projected training gains.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const { data: gameConfig, error } = await supabase
      .from('game_config')
      .select('config')
      .limit(1)
      .single();

    if (error || !gameConfig) {
      return res.status(500).json({ error: 'Failed to load game config' });
    }

    const config = gameConfig.config ?? {};

    return res.status(200).json({
      activities: config.activities ?? {},
      raceTypeWeights: config.race_type_weights ?? {},
      prizeDistribution: config.prize_distribution ?? [0.50, 0.30, 0.20],
    });
  } catch (err) {
    console.error('GET /api/v2/config error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
