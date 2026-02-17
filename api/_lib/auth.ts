import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'crypto';

/**
 * Check for admin authorization via CRON_SECRET bearer token.
 * Returns false and sends 401 if unauthorized.
 * Uses timing-safe comparison to prevent side-channel attacks (A1-2).
 */
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (!secret) {
    res.status(401).json({ error: 'Unauthorized - CRON_SECRET not configured' });
    return false;
  }

  if (secret.length < 32) {
    console.warn('CRON_SECRET is shorter than 32 characters — consider using a longer secret');
  }

  const expected = `Bearer ${secret}`;
  if (
    !authHeader ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
