import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeRaceEntry, ActionError } from '../../../_lib/execute-action.js';
import { REQUIRE_FEES } from '../../../_lib/constants.js';
import { supabase } from '../../../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const raceId = req.query.id as string;
  const { creatureIds, walletAddress, txId } = req.body ?? {};

  if (!raceId || !Array.isArray(creatureIds) || creatureIds.length === 0 || !walletAddress) {
    return res.status(400).json({ error: 'raceId, creatureIds (array), and walletAddress are required' });
  }

  // Fee gate: when fees are required, a txId must be provided.
  if (REQUIRE_FEES && !txId) {
    const { data: race } = await supabase
      .from('season_races')
      .select('entry_fee_nanoerg')
      .eq('id', raceId)
      .single();

    const perEntry = race?.entry_fee_nanoerg ?? 0;
    return res.status(402).json({
      error: 'Payment required',
      requiredAmount: perEntry * creatureIds.length,
      perEntry,
      count: creatureIds.length,
      message: 'Batch race entry requires an ERG fee. Submit a txId with your request.',
    });
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
