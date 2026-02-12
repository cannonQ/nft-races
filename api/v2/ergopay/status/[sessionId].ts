import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';

/**
 * Frontend polls this endpoint to check if the ErgoPay wallet has connected.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const { sessionId } = req.query as { sessionId: string };

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const { data: session, error: selectErr } = await supabase
      .from('ergopay_sessions')
      .select('address, expires_at')
      .eq('id', sessionId)
      .single();

    if (selectErr || !session) {
      return res.status(200).json({ status: 'not_found' });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(200).json({ status: 'expired' });
    }

    if (session.address) {
      return res.status(200).json({ status: 'connected', address: session.address });
    }

    return res.status(200).json({ status: 'pending' });
  } catch (err) {
    console.error('ErgoPay status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
