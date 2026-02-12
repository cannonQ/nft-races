import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../../_lib/auth.js';
import { resolveRace } from '../../../_lib/resolve-race.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!requireAdmin(req, res)) return;

  const { raceId } = req.body ?? {};
  if (!raceId) {
    return res.status(400).json({ error: 'raceId is required' });
  }

  try {
    const result = await resolveRace(raceId);

    if (!result.success) {
      return res.status(400).json({ error: result.reason });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('POST /api/v2/admin/races/resolve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
