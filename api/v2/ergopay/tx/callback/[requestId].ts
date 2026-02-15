/**
 * POST /api/v2/ergopay/tx/callback/[requestId]
 *
 * Wallet callback endpoint (replyTo) for the reduced TX flow.
 * The wallet POSTs { signedTxId } here after signing and broadcasting the TX.
 * We store the TX ID so the status poller can detect payment immediately.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const requestId = req.query.requestId as string;
  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required' });
  }

  // The wallet sends the signed TX ID in the body
  const { signedTxId, txId } = req.body ?? {};
  const detectedTxId = signedTxId || txId;

  if (!detectedTxId || typeof detectedTxId !== 'string') {
    return res.status(400).json({ error: 'signedTxId is required' });
  }

  try {
    // Update the request with the signed TX ID (only if still pending)
    const { data: updated, error: updateErr } = await supabase
      .from('ergopay_tx_requests')
      .update({ signed_tx_id: detectedTxId })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id')
      .single();

    if (updateErr || !updated) {
      // Already executed, expired, or not found — that's fine
      console.log(`ErgoPay callback ${requestId}: no pending row to update (already processed?)`);
    } else {
      console.log(`ErgoPay callback ${requestId}: stored signed TX ID ${detectedTxId}`);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('POST /api/v2/ergopay/tx/callback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
