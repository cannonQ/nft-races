import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeTraining, ActionError } from '../_lib/execute-action.js';
import { REQUIRE_FEES, TRAINING_FEE_NANOERG, TREASURY_ADDRESS } from '../_lib/constants.js';
import { isValidUUID, isValidErgoAddr } from '../_lib/helpers.js';
import { isTxIdUsed, verifyTxOnChain, verifyTokenTxOnChain } from '../_lib/verify-tx.js';
import { checkRateLimit, getClientIp } from '../_lib/rate-limit.js';
import { getGameConfig } from '../_lib/config.js';
import { supabase } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const rl = checkRateLimit(`${getClientIp(req)}:train`, 20, 60_000);
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const { creatureId, activity, walletAddress, boostRewardIds, recoveryRewardIds, txId, paymentCurrency } = req.body ?? {};

  if (!creatureId || !activity || !walletAddress) {
    return res.status(400).json({ error: 'creatureId, activity, and walletAddress are required' });
  }

  if (!isValidUUID(creatureId) || !isValidErgoAddr(walletAddress) || typeof activity !== 'string') {
    return res.status(400).json({ error: 'Invalid parameter format' });
  }

  // Look up creature's collection for fee token config
  let feeToken: any = null;
  if (REQUIRE_FEES) {
    const { data: creature } = await supabase
      .from('creatures')
      .select('collection_id')
      .eq('id', creatureId)
      .single();

    if (creature?.collection_id) {
      const mergedConfig = await getGameConfig(creature.collection_id);
      feeToken = mergedConfig?.fee_token ?? null;
    }
  }

  // Fee gate: when fees are required, a txId (from Nautilus) must be provided.
  // ErgoPay users go through the ergopay/tx flow instead.
  if (REQUIRE_FEES && !txId) {
    return res.status(402).json({
      error: 'Payment required',
      requiredAmountNanoerg: TRAINING_FEE_NANOERG,
      feeToken: feeToken ? {
        tokenId: feeToken.token_id,
        name: feeToken.name,
        amount: feeToken.training_fee,
        decimals: feeToken.decimals,
      } : null,
      message: 'Training requires a fee. Submit a txId with your request.',
    });
  }

  // TX verification (A3-1 + A3-2): dedup + on-chain amount check
  if (REQUIRE_FEES && txId) {
    if (await isTxIdUsed(txId)) {
      return res.status(409).json({ error: 'This transaction has already been used' });
    }
    if (TREASURY_ADDRESS) {
      if (paymentCurrency === 'token' && feeToken) {
        // Token payment — verify token amount at treasury
        const v = await verifyTokenTxOnChain(txId, TREASURY_ADDRESS, feeToken.token_id, BigInt(feeToken.training_fee) * BigInt(10 ** feeToken.decimals));
        if (!v.valid) {
          return res.status(400).json({ error: v.reason });
        }
      } else {
        // ERG payment (default)
        const v = await verifyTxOnChain(txId, TREASURY_ADDRESS, TRAINING_FEE_NANOERG);
        if (!v.valid) {
          return res.status(400).json({ error: v.reason });
        }
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
      paymentCurrency: paymentCurrency === 'token' ? 'token' : 'erg',
      feeTokenId: paymentCurrency === 'token' && feeToken ? feeToken.token_id : undefined,
      feeTokenAmount: paymentCurrency === 'token' && feeToken ? feeToken.training_fee : undefined,
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
