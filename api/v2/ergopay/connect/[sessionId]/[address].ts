import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../../_lib/supabase.js';

/**
 * ErgoPay wallet callback endpoint.
 *
 * Mobile wallets call this after replacing #P2PK_ADDRESS# in the ergopay:// URL.
 * Must return an ErgoPaySigningRequest JSON (EIP-20 spec).
 * Since we have no transaction to sign, we just return a confirmation message.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      message: 'Method not allowed',
      messageSeverity: 'ERROR',
    });
  }

  const { sessionId, address } = req.query as { sessionId: string; address: string };

  if (!sessionId || !address) {
    return res.status(400).json({
      message: 'Missing session or address',
      messageSeverity: 'ERROR',
    });
  }

  // Basic Ergo address validation (P2PK addresses are base58-encoded, typically 51 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{30,60}$/.test(address)) {
    return res.status(400).json({
      message: 'Invalid Ergo address format',
      messageSeverity: 'ERROR',
    });
  }

  try {
    // Look up the session — must exist, not expired, and not already claimed
    const { data: session, error: selectErr } = await supabase
      .from('ergopay_sessions')
      .select('id, address, expires_at')
      .eq('id', sessionId)
      .single();

    if (selectErr || !session) {
      return res.status(404).json({
        message: 'Session not found or expired. Please try connecting again.',
        messageSeverity: 'ERROR',
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(410).json({
        message: 'Session expired. Please try connecting again.',
        messageSeverity: 'ERROR',
      });
    }

    if (session.address) {
      return res.status(409).json({
        message: 'Session already claimed.',
        messageSeverity: 'ERROR',
      });
    }

    // Store the wallet address
    const { error: updateErr } = await supabase
      .from('ergopay_sessions')
      .update({ address })
      .eq('id', sessionId)
      .is('address', null);

    if (updateErr) {
      console.error('Failed to update ErgoPay session:', updateErr);
      return res.status(500).json({
        message: 'Failed to store address. Please try again.',
        messageSeverity: 'ERROR',
      });
    }

    // Return ErgoPaySigningRequest JSON (no reducedTx = address-only flow)
    return res.status(200).json({
      message: 'Connected to CyberPets Racing!',
      messageSeverity: 'INFORMATION',
    });
  } catch (err) {
    console.error('ErgoPay connect error:', err);
    return res.status(500).json({
      message: 'Internal server error',
      messageSeverity: 'ERROR',
    });
  }
}
