import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCsvTemplate } from '../../../_lib/csv-parser.js';

/**
 * GET /api/v2/admin/races/csv-template
 *
 * Returns a downloadable CSV template with headers + 3 example rows.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const template = getCsvTemplate();

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="race-schedule-template.csv"');
  return res.status(200).send(template);
}
