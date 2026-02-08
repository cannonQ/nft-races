import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Check for admin authorization via CRON_SECRET bearer token.
 * Returns false and sends 401 if unauthorized.
 */
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (!secret) {
    res.status(401).json({ error: 'Unauthorized - CRON_SECRET not configured' });
    return false;
  }

  if (authHeader !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
