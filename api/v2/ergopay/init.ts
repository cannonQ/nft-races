import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { supabase } from '../../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const sessionId = randomUUID();

    // Clean up expired sessions (cheap, keeps the table small)
    await supabase
      .from('ergopay_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());

    // Create new session
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: insertErr } = await supabase
      .from('ergopay_sessions')
      .insert({ id: sessionId, expires_at: expiresAt });

    if (insertErr) {
      console.error('Failed to create ErgoPay session:', insertErr);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    // Construct the ergopay:// URL
    // Wallet replaces #P2PK_ADDRESS# with the real address, then calls GET on the https:// version
    const host = process.env.ERGOPAY_HOST || process.env.VERCEL_URL || 'localhost:3000';
    const ergoPayUrl = `ergopay://${host}/api/v2/ergopay/connect/${sessionId}/#P2PK_ADDRESS#`;

    return res.status(200).json({
      sessionId,
      ergoPayUrl,
      expiresAt,
    });
  } catch (err) {
    console.error('ErgoPay init error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
