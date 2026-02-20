import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeRaceEntry, ActionError } from '../../../_lib/execute-action.js';
import { REQUIRE_FEES, TREASURY_ADDRESS } from '../../../_lib/constants.js';
import { supabase } from '../../../_lib/supabase.js';
import { isValidUUID, isValidErgoAddr } from '../../../_lib/helpers.js';
import { isTxIdUsed, verifyTxOnChain, verifyTokenTxOnChain } from '../../../_lib/verify-tx.js';
import { checkRateLimit, getClientIp } from '../../../_lib/rate-limit.js';
import { getGameConfig } from '../../../_lib/config.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const rl = checkRateLimit(`${getClientIp(req)}:race-enter`, 20, 60_000);
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const raceId = req.query.id as string;
  const { creatureId, walletAddress, txId, paymentCurrency } = req.body ?? {};

  if (!raceId || !creatureId || !walletAddress) {
    return res.status(400).json({ error: 'raceId, creatureId, and walletAddress are required' });
  }

  if (!isValidUUID(raceId) || !isValidUUID(creatureId) || !isValidErgoAddr(walletAddress)) {
    return res.status(400).json({ error: 'Invalid parameter format' });
  }

  // Fee gate + TX verification
  let feeToken: any = null;
  let entryFeeToken: number | null = null;

  if (REQUIRE_FEES) {
    const { data: race } = await supabase
      .from('season_races')
      .select('entry_fee_nanoerg, entry_fee_token, seasons!inner(collection_id)')
      .eq('id', raceId)
      .single();

    const entryFee = race?.entry_fee_nanoerg ?? 0;
    entryFeeToken = race?.entry_fee_token ?? null;

    // Look up collection fee token config
    const collectionId = race?.seasons?.collection_id;
    if (collectionId) {
      const mergedConfig = await getGameConfig(collectionId);
      feeToken = mergedConfig?.fee_token ?? null;
    }

    // Fallback to collection default token fee if race doesn't have one
    if (!entryFeeToken && feeToken) {
      entryFeeToken = feeToken.default_race_entry_fee ?? null;
    }

    if (!txId) {
      return res.status(402).json({
        error: 'Payment required',
        requiredAmountNanoerg: entryFee,
        feeToken: feeToken && entryFeeToken ? {
          tokenId: feeToken.token_id,
          name: feeToken.name,
          amount: entryFeeToken,
          decimals: feeToken.decimals,
        } : null,
        message: 'Race entry requires a fee. Submit a txId with your request.',
      });
    }

    // TX verification (A3-1 + A3-2): dedup + on-chain amount check
    if (await isTxIdUsed(txId)) {
      return res.status(409).json({ error: 'This transaction has already been used' });
    }
    if (TREASURY_ADDRESS) {
      if (paymentCurrency === 'token' && feeToken && entryFeeToken) {
        const v = await verifyTokenTxOnChain(txId, TREASURY_ADDRESS, feeToken.token_id, BigInt(entryFeeToken) * BigInt(10 ** feeToken.decimals));
        if (!v.valid) {
          return res.status(400).json({ error: v.reason });
        }
      } else if (entryFee > 0) {
        const v = await verifyTxOnChain(txId, TREASURY_ADDRESS, entryFee);
        if (!v.valid) {
          return res.status(400).json({ error: v.reason });
        }
      }
    }
  }

  try {
    const result = await executeRaceEntry({
      raceId,
      creatureId,
      walletAddress,
      txId,
      paymentCurrency: paymentCurrency === 'token' ? 'token' : 'erg',
      feeTokenId: paymentCurrency === 'token' && feeToken ? feeToken.token_id : undefined,
      feeTokenAmount: paymentCurrency === 'token' && entryFeeToken ? entryFeeToken : undefined,
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ActionError) {
      return res.status(err.status).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('POST /api/v2/races/[id]/enter error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: message });
  }
}
