import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../../_lib/auth.js';
import { parseRaceCsv } from '../../../_lib/csv-parser.js';

/**
 * POST /api/v2/admin/races/parse-csv
 *
 * Stateless parser — accepts CSV text + baseDate, returns parsed race array.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdmin(req, res)) return;

  try {
    const {
      csv,
      baseDate: baseDateStr,
      spacingMinutes = 360,
      defaults,
    } = req.body ?? {};

    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'csv string is required' });
    }
    if (!baseDateStr) {
      return res.status(400).json({ error: 'baseDate is required' });
    }

    const baseDate = new Date(baseDateStr);
    if (isNaN(baseDate.getTime())) {
      return res.status(400).json({ error: 'Invalid baseDate' });
    }

    const spacing = Math.max(1, Math.min(1440, Number(spacingMinutes) || 360));

    const defaultFees = {
      entryFeeNanoerg: defaults?.entryFeeNanoerg ?? 0,
      entryFeeToken: defaults?.entryFeeToken ?? null,
    };

    const result = parseRaceCsv(csv, baseDate, spacing, defaultFees);

    // Build summary
    const summary = {
      open: result.races.filter(r => !r.rarityClass).length,
      rookie: result.races.filter(r => r.rarityClass === 'rookie').length,
      contender: result.races.filter(r => r.rarityClass === 'contender').length,
      champion: result.races.filter(r => r.rarityClass === 'champion').length,
    };

    return res.status(200).json({
      success: true,
      parsed: result.races.length,
      warnings: result.warnings,
      summary,
      races: result.races,
    });
  } catch (err) {
    console.error('POST /api/v2/admin/races/parse-csv error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
