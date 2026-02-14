import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGameConfig } from '../_lib/config.js';

/**
 * GET /api/v2/config
 * Returns public game configuration: activity definitions and race type weights.
 * Accepts optional ?collectionId= to return collection-specific merged config.
 * Used by frontend to show accurate projected training gains.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const collectionId = req.query.collectionId as string | undefined;
    const config = await getGameConfig(collectionId);

    return res.status(200).json({
      activities: config.activities ?? {},
      raceTypeWeights: config.race_type_weights ?? {},
      prizeDistribution: config.prize_distribution ?? [0.50, 0.30, 0.20],
      perStatCap: config.per_stat_cap ?? 80,
      totalStatCap: config.total_stat_cap ?? 300,
      baseActions: config.base_actions ?? 2,
      cooldownHours: config.cooldown_hours ?? 6,
    });
  } catch (err) {
    console.error('GET /api/v2/config error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
