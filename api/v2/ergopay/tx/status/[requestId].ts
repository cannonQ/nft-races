/**
 * GET /api/v2/ergopay/tx/status/[requestId]
 *
 * Polls the status of an ErgoPay payment request.
 * When the payment is confirmed, executes the game action server-side.
 * Uses row-level locking to prevent double-execution from concurrent polls.
 *
 * Detection strategy (in order):
 * 1. Check our DB for signed_tx_id (set by the wallet callback at /callback/[requestId])
 * 2. Fallback: check Ergo blockchain directly (mempool + confirmed TXs)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../../_lib/supabase.js';
import { executeTraining, executeRaceEntry, ActionError } from '../../../../_lib/execute-action.js';
import { executeTreatmentStart } from '../../../../_lib/execute-treatment.js';
import { TREASURY_ADDRESS } from '../../../../_lib/constants.js';
import { isTxIdUsed, detectPaymentOnChain } from '../../../../_lib/verify-tx.js';

// ── Handler ────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const requestId = req.query.requestId as string;
  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required' });
  }

  try {
    // 1. Fetch our stored request
    const { data: txReq, error: fetchErr } = await supabase
      .from('ergopay_tx_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !txReq) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    // 2. If already executed, return cached result
    if (txReq.status === 'executed') {
      return res.status(200).json({
        status: 'executed',
        txId: txReq.signed_tx_id,
        result: txReq.result_payload,
      });
    }

    // 3. If already failed/expired, return that status
    if (txReq.status === 'expired' || txReq.status === 'failed') {
      return res.status(200).json({ status: txReq.status });
    }

    // 4. If currently being executed by another request, tell frontend to keep waiting
    if (txReq.status === 'executing') {
      return res.status(200).json({ status: 'pending' });
    }

    // 5. Check if expired by time
    if (new Date(txReq.expires_at) < new Date()) {
      await supabase
        .from('ergopay_tx_requests')
        .update({ status: 'expired' })
        .eq('id', requestId)
        .eq('status', 'pending');

      return res.status(200).json({ status: 'expired' });
    }

    // ── Payment detection ──────────────────────────────────────────

    let detectedTxId: string | null = null;

    // 6a. Check if the wallet callback already stored a signed TX ID
    if (txReq.signed_tx_id) {
      detectedTxId = txReq.signed_tx_id;
      console.log(`ErgoPay ${requestId}: TX ID from wallet callback: ${detectedTxId}`);
    }

    // 6b. Fallback: check blockchain directly (mempool + confirmed)
    if (!detectedTxId && TREASURY_ADDRESS) {
      const chainTx = await detectPaymentOnChain(
        txReq.wallet_address,
        TREASURY_ADDRESS,
        txReq.amount_nanoerg,
        new Date(txReq.created_at).getTime(),
      );
      if (chainTx) {
        detectedTxId = chainTx.txId;
        console.log(`ErgoPay ${requestId}: payment detected on-chain (fallback): ${detectedTxId}`);
      }
    }

    // Still no payment detected — keep polling
    if (!detectedTxId) {
      return res.status(200).json({ status: 'pending' });
    }

    // ── Payment confirmed — execute game action ────────────────────

    // 6c. Dedup check (A3-2/A3-3): reject if this TX was already consumed
    if (await isTxIdUsed(detectedTxId)) {
      await supabase
        .from('ergopay_tx_requests')
        .update({ status: 'failed', result_payload: { error: 'Payment TX already used' } })
        .eq('id', requestId)
        .eq('status', 'pending');

      return res.status(200).json({
        status: 'failed',
        error: 'This payment transaction was already used for another action',
      });
    }

    // 7. Lock the row to prevent double-execution.
    // Only one concurrent request will succeed in this update.
    const { data: locked, error: lockErr } = await supabase
      .from('ergopay_tx_requests')
      .update({ status: 'executing', signed_tx_id: detectedTxId })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id')
      .single();

    if (lockErr || !locked) {
      // Another request already locked it — return pending, they'll get the result next poll
      return res.status(200).json({ status: 'pending' });
    }

    // 8. Execute the game action
    try {
      let result: any;

      // Extract token payment info from stored payload
      const storedCurrency = txReq.payment_currency || txReq.action_payload?.paymentCurrency;
      const storedFeeTokenId = txReq.action_payload?.feeTokenId;
      const storedFeeTokenAmount = txReq.action_payload?.feeTokenAmount;

      if (txReq.action_type === 'training_fee') {
        // Batch training: action_payload.creatures[] if present
        const batchCreatures: any[] | null = txReq.action_payload?.creatures;
        if (Array.isArray(batchCreatures) && batchCreatures.length > 1) {
          const results: Array<{ creatureId: string; result: any }> = [];
          const errors: Array<{ creatureId: string; error: string }> = [];
          for (const c of batchCreatures) {
            try {
              const trainResult = await executeTraining({
                creatureId: c.creatureId,
                activity: c.activity,
                walletAddress: txReq.wallet_address,
                boostRewardIds: c.boostRewardIds || undefined,
                recoveryRewardIds: c.recoveryRewardIds || undefined,
                txId: detectedTxId,
                paymentCurrency: storedCurrency || undefined,
                feeTokenId: storedFeeTokenId || undefined,
                feeTokenAmount: storedFeeTokenAmount || undefined,
              });
              results.push({ creatureId: c.creatureId, result: trainResult });
            } catch (err: any) {
              errors.push({ creatureId: c.creatureId, error: err?.message || String(err) });
            }
          }
          result = { success: true, results, ...(errors.length > 0 ? { partial: true, errors } : {}) };
        } else {
          result = await executeTraining({
            creatureId: txReq.creature_id,
            activity: txReq.action_payload?.activity,
            walletAddress: txReq.wallet_address,
            boostRewardIds: txReq.action_payload?.boostRewardIds || undefined,
            recoveryRewardIds: txReq.action_payload?.recoveryRewardIds || undefined,
            txId: detectedTxId,
            paymentCurrency: storedCurrency || undefined,
            feeTokenId: storedFeeTokenId || undefined,
            feeTokenAmount: storedFeeTokenAmount || undefined,
          });
        }
      } else if (txReq.action_type === 'race_entry_fee') {
        // Batch support: action_payload.creatureIds[] if present
        const batchIds: string[] | null = txReq.action_payload?.creatureIds;
        if (Array.isArray(batchIds) && batchIds.length > 1) {
          const entries: Array<{ creatureId: string; entryId: string }> = [];
          for (const cId of batchIds) {
            const entryResult = await executeRaceEntry({
              raceId: txReq.race_id,
              creatureId: cId,
              walletAddress: txReq.wallet_address,
              txId: detectedTxId,
              paymentCurrency: storedCurrency || undefined,
              feeTokenId: storedFeeTokenId || undefined,
              feeTokenAmount: storedFeeTokenAmount || undefined,
            });
            entries.push({ creatureId: cId, entryId: entryResult.entryId });
          }
          result = { success: true, entries };
        } else {
          result = await executeRaceEntry({
            raceId: txReq.race_id,
            creatureId: txReq.creature_id,
            walletAddress: txReq.wallet_address,
            txId: detectedTxId,
            paymentCurrency: storedCurrency || undefined,
            feeTokenId: storedFeeTokenId || undefined,
            feeTokenAmount: storedFeeTokenAmount || undefined,
          });
        }
      } else if (txReq.action_type === 'treatment_fee') {
        result = await executeTreatmentStart({
          creatureId: txReq.creature_id,
          treatmentType: txReq.action_payload?.treatmentType,
          walletAddress: txReq.wallet_address,
          txId: detectedTxId,
          paymentCurrency: storedCurrency || undefined,
          feeTokenId: storedFeeTokenId || undefined,
          feeTokenAmount: storedFeeTokenAmount || undefined,
        });
      } else {
        throw new Error(`Unknown action_type: ${txReq.action_type}`);
      }

      // Mark as executed with result
      await supabase
        .from('ergopay_tx_requests')
        .update({ status: 'executed', result_payload: result })
        .eq('id', requestId);

      return res.status(200).json({
        status: 'executed',
        txId: detectedTxId,
        result,
      });
    } catch (actionErr) {
      // Action failed after payment — mark as failed so user knows
      const message = actionErr instanceof Error ? actionErr.message : 'Action execution failed';
      console.error(`ErgoPay action execution failed for ${requestId}:`, actionErr);

      await supabase
        .from('ergopay_tx_requests')
        .update({
          status: 'failed',
          result_payload: { error: message },
        })
        .eq('id', requestId);

      return res.status(200).json({
        status: 'failed',
        error: message,
      });
    }
  } catch (err) {
    console.error('GET /api/v2/ergopay/tx/status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
