import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeTreatmentStart } from '../../_lib/execute-treatment.js';
import { ActionError } from '../../_lib/execute-action.js';
import { REQUIRE_FEES } from '../../_lib/constants.js';
import { isValidUUID, isValidErgoAddr } from '../../_lib/helpers.js';
import { isTxIdUsed } from '../../_lib/verify-tx.js';
import { checkRateLimit, getClientIp } from '../../_lib/rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const rl = checkRateLimit(`${getClientIp(req)}:treatment`, 10, 60_000);
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const { creatureId, treatmentType, walletAddress, txId } = req.body ?? {};

  if (!creatureId || !treatmentType || !walletAddress) {
    return res.status(400).json({ error: 'creatureId, treatmentType, and walletAddress are required' });
  }

  if (!isValidUUID(creatureId) || !isValidErgoAddr(walletAddress) || typeof treatmentType !== 'string') {
    return res.status(400).json({ error: 'Invalid parameter format' });
  }

  // Fee gate: when fees are required, a txId (from Nautilus) must be provided.
  // ErgoPay users go through the ergopay/tx flow instead.
  if (REQUIRE_FEES && !txId) {
    return res.status(402).json({
      error: 'Payment required',
      message: 'Treatment requires an ERG fee. Submit a txId with your request.',
    });
  }

  // TX dedup check (A3-2): treatment cost is config-dependent,
  // so on-chain amount verification is deferred to Phase 2.
  if (REQUIRE_FEES && txId) {
    if (await isTxIdUsed(txId)) {
      return res.status(409).json({ error: 'This transaction has already been used' });
    }
  }

  try {
    const result = await executeTreatmentStart({
      creatureId,
      treatmentType,
      walletAddress,
      txId,
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ActionError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('POST /api/v2/treatment/start error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
