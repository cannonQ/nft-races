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

  const rl = checkRateLimit(`${getClientIp(req)}:race-enter`, 10, 60_000);
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const raceId = req.query.id as string;
  const { creatureIds, walletAddress, txId, paymentCurrency } = req.body ?? {};

  if (!raceId || !Array.isArray(creatureIds) || creatureIds.length === 0 || !walletAddress) {
    return res.status(400).json({ error: 'raceId, creatureIds (array), and walletAddress are required' });
  }

  if (!isValidUUID(raceId) || !isValidErgoAddr(walletAddress) || !creatureIds.every(isValidUUID)) {
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

    const perEntry = race?.entry_fee_nanoerg ?? 0;
    const totalRequired = perEntry * creatureIds.length;
    entryFeeToken = race?.entry_fee_token ?? null;

    // Look up collection fee token config
    const collectionId = (race?.seasons as any)?.collection_id;
    if (collectionId) {
      const mergedConfig = await getGameConfig(collectionId);
      feeToken = mergedConfig?.fee_token ?? null;
    }

    // Fallback to collection default token fee if race doesn't have one
    if (!entryFeeToken && feeToken) {
      entryFeeToken = feeToken.default_race_entry_fee ?? null;
    }

    if (!txId) {
      const totalTokenRequired = entryFeeToken ? entryFeeToken * creatureIds.length : null;
      return res.status(402).json({
        error: 'Payment required',
        requiredAmountNanoerg: totalRequired,
        perEntry,
        count: creatureIds.length,
        feeToken: feeToken && entryFeeToken ? {
          tokenId: feeToken.token_id,
          name: feeToken.name,
          amount: totalTokenRequired,
          perEntry: entryFeeToken,
          decimals: feeToken.decimals,
        } : null,
        message: 'Batch race entry requires a fee. Submit a txId with your request.',
      });
    }

    // TX verification: dedup + on-chain amount check
    if (await isTxIdUsed(txId)) {
      return res.status(409).json({ error: 'This transaction has already been used' });
    }
    if (TREASURY_ADDRESS) {
      if (paymentCurrency === 'token' && feeToken && entryFeeToken) {
        const totalTokens = BigInt(entryFeeToken) * BigInt(10 ** feeToken.decimals) * BigInt(creatureIds.length);
        const v = await verifyTokenTxOnChain(txId, TREASURY_ADDRESS, feeToken.token_id, totalTokens);
        if (!v.valid) {
          return res.status(400).json({ error: v.reason });
        }
      } else if (totalRequired > 0) {
        const v = await verifyTxOnChain(txId, TREASURY_ADDRESS, totalRequired);
        if (!v.valid) {
          return res.status(400).json({ error: v.reason });
        }
      }
    }
  }

  // Process all entries
  const results: Array<{ creatureId: string; entryId: string }> = [];
  const errors: Array<{ creatureId: string; error: string }> = [];

  for (const creatureId of creatureIds) {
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
      results.push({ creatureId, entryId: result.entryId });
    } catch (err) {
      const message = err instanceof ActionError ? err.message : (err instanceof Error ? err.message : String(err));
      errors.push({ creatureId, error: message });
    }
  }

  if (errors.length > 0 && results.length === 0) {
    return res.status(400).json({ error: 'All entries failed', details: errors });
  }

  if (errors.length > 0) {
    return res.status(207).json({ success: true, partial: true, entries: results, errors });
  }

  return res.status(200).json({ success: true, entries: results });
}
