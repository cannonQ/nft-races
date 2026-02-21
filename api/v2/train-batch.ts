import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeTraining, ActionError } from '../_lib/execute-action.js';
import { REQUIRE_FEES, TRAINING_FEE_NANOERG, TREASURY_ADDRESS } from '../_lib/constants.js';
import { supabase } from '../_lib/supabase.js';
import { isValidUUID, isValidErgoAddr } from '../_lib/helpers.js';
import { isTxIdUsed, verifyTxOnChain, verifyTokenTxOnChain } from '../_lib/verify-tx.js';
import { checkRateLimit, getClientIp } from '../_lib/rate-limit.js';
import { getGameConfig } from '../_lib/config.js';

const MAX_BATCH_SIZE = 20;

interface BatchCreatureInput {
  creatureId: string;
  activity: string;
  boostRewardIds?: string[];
  recoveryRewardIds?: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const rl = checkRateLimit(`${getClientIp(req)}:train-batch`, 10, 60_000);
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const { creatures, walletAddress, txId, paymentCurrency } = req.body ?? {};

  if (!Array.isArray(creatures) || creatures.length === 0 || !walletAddress) {
    return res.status(400).json({ error: 'creatures (array) and walletAddress are required' });
  }

  if (creatures.length > MAX_BATCH_SIZE) {
    return res.status(400).json({ error: `Batch size cannot exceed ${MAX_BATCH_SIZE}` });
  }

  if (!isValidErgoAddr(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address format' });
  }

  // Validate each creature input
  for (const c of creatures as BatchCreatureInput[]) {
    if (!c.creatureId || !c.activity) {
      return res.status(400).json({ error: 'Each creature must have creatureId and activity' });
    }
    if (!isValidUUID(c.creatureId) || typeof c.activity !== 'string') {
      return res.status(400).json({ error: `Invalid format for creature ${c.creatureId}` });
    }
  }

  const batch = creatures as BatchCreatureInput[];

  // Verify all creatures are from the same collection (same fee config)
  const { data: creatureRows, error: crErr } = await supabase
    .from('creatures')
    .select('id, collection_id')
    .in('id', batch.map(c => c.creatureId));

  if (crErr || !creatureRows || creatureRows.length === 0) {
    return res.status(400).json({ error: 'Could not look up creatures' });
  }

  const collectionIds = new Set(creatureRows.map(r => r.collection_id));
  if (collectionIds.size > 1) {
    return res.status(400).json({ error: 'All creatures in a batch must belong to the same collection' });
  }

  const collectionId = creatureRows[0].collection_id;

  // Fee gate + TX verification
  let feeToken: any = null;

  if (REQUIRE_FEES) {
    if (collectionId) {
      const mergedConfig = await getGameConfig(collectionId);
      feeToken = mergedConfig?.fee_token ?? null;
    }

    const trainingFeeToken = feeToken?.training_fee ?? null;
    const totalRequiredNanoerg = TRAINING_FEE_NANOERG * batch.length;

    if (!txId) {
      const totalTokenRequired = trainingFeeToken ? trainingFeeToken * batch.length : null;
      return res.status(402).json({
        error: 'Payment required',
        requiredAmountNanoerg: totalRequiredNanoerg,
        perEntry: TRAINING_FEE_NANOERG,
        count: batch.length,
        feeToken: feeToken && trainingFeeToken ? {
          tokenId: feeToken.token_id,
          name: feeToken.name,
          amount: totalTokenRequired,
          perEntry: trainingFeeToken,
          decimals: feeToken.decimals,
        } : null,
        message: 'Batch training requires a fee. Submit a txId with your request.',
      });
    }

    // TX verification: dedup + on-chain amount check
    if (await isTxIdUsed(txId)) {
      return res.status(409).json({ error: 'This transaction has already been used' });
    }
    if (TREASURY_ADDRESS) {
      if (paymentCurrency === 'token' && feeToken && trainingFeeToken) {
        const totalTokens = BigInt(trainingFeeToken) * BigInt(10 ** feeToken.decimals) * BigInt(batch.length);
        const v = await verifyTokenTxOnChain(txId, TREASURY_ADDRESS, feeToken.token_id, totalTokens);
        if (!v.valid) {
          return res.status(400).json({ error: v.reason });
        }
      } else if (totalRequiredNanoerg > 0) {
        const v = await verifyTxOnChain(txId, TREASURY_ADDRESS, totalRequiredNanoerg);
        if (!v.valid) {
          return res.status(400).json({ error: v.reason });
        }
      }
    }
  }

  // Process all training actions
  const results: Array<{ creatureId: string; result: any }> = [];
  const errors: Array<{ creatureId: string; error: string }> = [];

  for (const c of batch) {
    try {
      const result = await executeTraining({
        creatureId: c.creatureId,
        activity: c.activity,
        walletAddress,
        boostRewardIds: c.boostRewardIds,
        recoveryRewardIds: c.recoveryRewardIds,
        txId,
        paymentCurrency: paymentCurrency === 'token' ? 'token' : 'erg',
        feeTokenId: paymentCurrency === 'token' && feeToken ? feeToken.token_id : undefined,
        feeTokenAmount: paymentCurrency === 'token' && feeToken ? feeToken.training_fee : undefined,
      });
      results.push({ creatureId: c.creatureId, result });
    } catch (err) {
      const message = err instanceof ActionError ? err.message : (err instanceof Error ? err.message : String(err));
      errors.push({ creatureId: c.creatureId, error: message });
    }
  }

  if (errors.length > 0 && results.length === 0) {
    return res.status(400).json({ error: 'All training actions failed', details: errors });
  }

  if (errors.length > 0) {
    return res.status(207).json({ success: true, partial: true, results, errors });
  }

  return res.status(200).json({ success: true, results });
}
