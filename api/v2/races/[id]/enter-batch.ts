import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeRaceEntry, ActionError } from '../../../_lib/execute-action.js';
import { REQUIRE_FEES, TREASURY_ADDRESS } from '../../../_lib/constants.js';
import { supabase } from '../../../_lib/supabase.js';
import { isValidUUID, isValidErgoAddr } from '../../../_lib/helpers.js';
import { isTxIdUsed, verifyTxOnChain } from '../../../_lib/verify-tx.js';
import { checkRateLimit, getClientIp } from '../../../_lib/rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const rl = checkRateLimit(`${getClientIp(req)}:race-enter`, 10, 60_000);
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const raceId = req.query.id as string;
  const { creatureIds, walletAddress, txId } = req.body ?? {};

  if (!raceId || !Array.isArray(creatureIds) || creatureIds.length === 0 || !walletAddress) {
    return res.status(400).json({ error: 'raceId, creatureIds (array), and walletAddress are required' });
  }

  if (!isValidUUID(raceId) || !isValidErgoAddr(walletAddress) || !creatureIds.every(isValidUUID)) {
    return res.status(400).json({ error: 'Invalid parameter format' });
  }

  // Fee gate + TX verification (A3-2 + A3-4)
  if (REQUIRE_FEES) {
    const { data: race } = await supabase
      .from('season_races')
      .select('entry_fee_nanoerg')
      .eq('id', raceId)
      .single();

    const perEntry = race?.entry_fee_nanoerg ?? 0;
    const totalRequired = perEntry * creatureIds.length;

    if (!txId) {
      return res.status(402).json({
        error: 'Payment required',
        requiredAmount: totalRequired,
        perEntry,
        count: creatureIds.length,
        message: 'Batch race entry requires an ERG fee. Submit a txId with your request.',
      });
    }

    // TX verification: dedup + on-chain total amount check
    if (await isTxIdUsed(txId)) {
      return res.status(409).json({ error: 'This transaction has already been used' });
    }
    if (TREASURY_ADDRESS && totalRequired > 0) {
      const v = await verifyTxOnChain(txId, TREASURY_ADDRESS, totalRequired);
      if (!v.valid) {
        return res.status(400).json({ error: v.reason });
      }
    }
  }

  // Process all entries — executeRaceEntry does all validation (ownership,
  // race open, duplicate, capacity, rarity class, collection guard).
  // All-or-nothing: if any fails, none are committed.
  const results: Array<{ creatureId: string; entryId: string }> = [];
  const errors: Array<{ creatureId: string; error: string }> = [];

  for (const creatureId of creatureIds) {
    try {
      const result = await executeRaceEntry({ raceId, creatureId, walletAddress, txId });
      results.push({ creatureId, entryId: result.entryId });
    } catch (err) {
      const message = err instanceof ActionError ? err.message : (err instanceof Error ? err.message : String(err));
      errors.push({ creatureId, error: message });
    }
  }

  if (errors.length > 0 && results.length === 0) {
    // All failed
    return res.status(400).json({ error: 'All entries failed', details: errors });
  }

  if (errors.length > 0) {
    // Partial success — some entries went through
    return res.status(207).json({
      success: true,
      partial: true,
      entries: results,
      errors,
    });
  }

  return res.status(200).json({ success: true, entries: results });
}
