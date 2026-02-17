import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeTraining, ActionError } from '../_lib/execute-action.js';
import { REQUIRE_FEES, TRAINING_FEE_NANOERG, TREASURY_ADDRESS } from '../_lib/constants.js';
import { isValidUUID, isValidErgoAddr } from '../_lib/helpers.js';
import { isTxIdUsed, verifyTxOnChain } from '../_lib/verify-tx.js';
import { checkRateLimit, getClientIp } from '../_lib/rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const rl = checkRateLimit(`${getClientIp(req)}:train`, 20, 60_000);
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const { creatureId, activity, walletAddress, boostRewardIds, recoveryRewardIds, txId } = req.body ?? {};

  if (!creatureId || !activity || !walletAddress) {
    return res.status(400).json({ error: 'creatureId, activity, and walletAddress are required' });
  }

  if (!isValidUUID(creatureId) || !isValidErgoAddr(walletAddress) || typeof activity !== 'string') {
    return res.status(400).json({ error: 'Invalid parameter format' });
  }

  // Fee gate: when fees are required, a txId (from Nautilus) must be provided.
  // ErgoPay users go through the ergopay/tx flow instead.
  if (REQUIRE_FEES && !txId) {
    return res.status(402).json({
      error: 'Payment required',
      requiredAmount: TRAINING_FEE_NANOERG,
      message: 'Training requires a 0.01 ERG fee. Submit a txId with your request.',
    });
  }

  // TX verification (A3-1 + A3-2): dedup + on-chain amount check
  if (REQUIRE_FEES && txId) {
    if (await isTxIdUsed(txId)) {
      return res.status(409).json({ error: 'This transaction has already been used' });
    }
    if (TREASURY_ADDRESS) {
      const v = await verifyTxOnChain(txId, TREASURY_ADDRESS, TRAINING_FEE_NANOERG);
      if (!v.valid) {
        return res.status(400).json({ error: v.reason });
      }
    }
  }

  try {
    const result = await executeTraining({
      creatureId,
      activity,
      walletAddress,
      boostRewardIds,
      recoveryRewardIds,
      txId,
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ActionError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('POST /api/v2/train error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
