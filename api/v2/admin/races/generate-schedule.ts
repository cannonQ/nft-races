import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../../_lib/auth.js';
import { getActiveSeason } from '../../../_lib/helpers.js';
import { getGameConfig } from '../../../_lib/config.js';
import { generateSchedule, DEFAULT_SCHEDULE_TEMPLATE } from '../../../_lib/schedule-generator.js';
import type { ScheduleTemplate } from '../../../_lib/schedule-generator.js';


/**
 * POST /api/v2/admin/races/generate-schedule
 *
 * Preview-only — no DB writes. Returns race array for admin review.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdmin(req, res)) return;

  try {
    const {
      collectionId,
      seasonId,
      startDate: startDateStr,
      endDate: endDateStr,
      template: templateOverrides,
    } = req.body ?? {};

    if (!startDateStr || !endDateStr) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid startDate or endDate' });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'endDate must be after startDate' });
    }

    // Resolve default fees from game config
    let defaultFeeNanoerg = 0;
    let defaultFeeToken: number | null = null;

    const resolvedCollectionId = collectionId ?? null;
    let configCollectionId = resolvedCollectionId;

    if (!configCollectionId && seasonId) {
      const season = await getActiveSeason();
      configCollectionId = season?.collection_id ?? null;
    }

    if (configCollectionId) {
      const config = await getGameConfig(configCollectionId);
      defaultFeeNanoerg = config?.default_race_entry_fee_nanoerg ?? 0;
      const feeTokenConfig = config?.fee_token;
      if (feeTokenConfig?.default_race_entry_fee) {
        defaultFeeToken = feeTokenConfig.default_race_entry_fee;
      }
    }

    // Merge template overrides onto the default
    const template: ScheduleTemplate = templateOverrides
      ? { ...DEFAULT_SCHEDULE_TEMPLATE, ...templateOverrides }
      : DEFAULT_SCHEDULE_TEMPLATE;

    const races = generateSchedule(template, startDate, endDate, {
      entryFeeNanoerg: defaultFeeNanoerg,
      entryFeeToken: defaultFeeToken,
    });

    // Build summary counts
    const summary = {
      open: races.filter(r => !r.rarityClass).length,
      rookie: races.filter(r => r.rarityClass === 'rookie').length,
      contender: races.filter(r => r.rarityClass === 'contender').length,
      champion: races.filter(r => r.rarityClass === 'champion').length,
    };

    return res.status(200).json({
      success: true,
      totalRaces: races.length,
      summary,
      races,
    });
  } catch (err) {
    console.error('POST /api/v2/admin/races/generate-schedule error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
