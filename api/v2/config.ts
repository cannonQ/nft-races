import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGameConfig } from '../_lib/config.js';
import { TREASURY_ERGO_TREE, REQUIRE_FEES, TRAINING_FEE_NANOERG } from '../_lib/constants.js';

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
      // Sharpness modifier (race scoring)
      sharpnessModFloor: config.sharpness_mod_floor ?? 0.80,
      sharpnessModCeiling: config.sharpness_mod_ceiling ?? 1.05,
      // Sharpness decay
      sharpnessGraceHours: config.sharpness_grace_hours ?? 12,
      sharpnessDecayPerDay: config.sharpness_decay_per_day ?? 15,
      // Fatigue decay tiers
      fatigueDecayTiers: config.fatigue_decay_tiers ?? [
        { below: 30, rate: 3 },
        { below: 60, rate: 6 },
        { below: 80, rate: 10 },
        { below: 101, rate: 15 },
      ],
      // Treatment tiers
      treatments: config.treatments ?? {},
      // Fee config (frontend reads these to decide payment flow)
      requireFees: REQUIRE_FEES,
      treasuryErgoTree: TREASURY_ERGO_TREE,
      trainingFeeNanoerg: TRAINING_FEE_NANOERG,
      // Token fees (from collection config, null if ERG-only)
      feeToken: config.fee_token ?? null,
      // Babel config
      babel: config.babel ?? { enabled: false },
      // Per-collection rarity class mapping (for class races)
      class_rarities: config.class_rarities ?? null,
    });
  } catch (err) {
    console.error('GET /api/v2/config error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
