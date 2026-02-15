import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeRaceEntry, ActionError } from '../../../_lib/execute-action.js';
import { REQUIRE_FEES } from '../../../_lib/constants.js';
import { supabase } from '../../../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const raceId = req.query.id as string;
  const { creatureId, walletAddress, txId } = req.body ?? {};

  if (!raceId || !creatureId || !walletAddress) {
    return res.status(400).json({ error: 'raceId, creatureId, and walletAddress are required' });
  }

  // Fee gate: when fees are required, a txId must be provided.
  // ErgoPay users go through the ergopay/tx flow instead.
  if (REQUIRE_FEES && !txId) {
    // Look up the race entry fee to include in the 402 response
    const { data: race } = await supabase
      .from('season_races')
      .select('entry_fee_nanoerg')
      .eq('id', raceId)
      .single();

    return res.status(402).json({
      error: 'Payment required',
      requiredAmount: race?.entry_fee_nanoerg ?? 0,
      message: 'Race entry requires an ERG fee. Submit a txId with your request.',
    });
  }

  try {
    const result = await executeRaceEntry({
      raceId,
      creatureId,
      walletAddress,
      txId,
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
