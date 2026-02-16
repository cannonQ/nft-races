import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeTraining, ActionError } from '../_lib/execute-action.js';
import { REQUIRE_FEES, TRAINING_FEE_NANOERG } from '../_lib/constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { creatureId, activity, walletAddress, boostRewardIds, recoveryRewardIds, txId } = req.body ?? {};

  if (!creatureId || !activity || !walletAddress) {
    return res.status(400).json({ error: 'creatureId, activity, and walletAddress are required' });
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
