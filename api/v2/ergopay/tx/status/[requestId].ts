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
import { TREASURY_ADDRESS } from '../../../../_lib/constants.js';

const EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

// ── Blockchain fallback ────────────────────────────────────────────
/**
 * Check the Ergo blockchain (mempool + confirmed) for a payment TX
 * matching the sender, treasury, and amount.
 */
async function detectPaymentOnChain(
  senderAddress: string,
  treasuryAddress: string,
  amountNanoerg: number,
  createdAfterMs: number,
): Promise<{ txId: string } | null> {
  try {
    // 1. Check mempool (unconfirmed) — catches TX before it confirms
    try {
      const mempoolResp = await fetch(
        `${EXPLORER_API}/mempool/transactions/byAddress/${senderAddress}`,
        { headers: { Accept: 'application/json' } },
      );
      if (mempoolResp.ok) {
        const mempoolData = await mempoolResp.json();
        const items = Array.isArray(mempoolData) ? mempoolData : (mempoolData.items || []);
        for (const tx of items) {
          const hasPayment = (tx.outputs || []).some(
            (o: any) => o.address === treasuryAddress && o.value === amountNanoerg,
          );
          if (hasPayment) return { txId: tx.id };
        }
      }
    } catch {
      // mempool check is best-effort
    }

    // 2. Check recent confirmed TXs for the sender
    const resp = await fetch(
      `${EXPLORER_API}/addresses/${senderAddress}/transactions?limit=10&sortBy=height&sortDirection=desc`,
      { headers: { Accept: 'application/json' } },
    );
    if (resp.ok) {
      const data = await resp.json();
      for (const tx of data.items || []) {
        // Skip TXs from before the payment request was created
        if (tx.timestamp && tx.timestamp < createdAfterMs) continue;

        const hasPayment = (tx.outputs || []).some(
          (o: any) => o.address === treasuryAddress && o.value === amountNanoerg,
        );
        if (hasPayment) return { txId: tx.id };
      }
    }

    return null;
  } catch (err) {
    console.error('detectPaymentOnChain error:', err);
    return null;
  }
}

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

      if (txReq.action_type === 'training_fee') {
        result = await executeTraining({
          creatureId: txReq.creature_id,
          activity: txReq.action_payload?.activity,
          walletAddress: txReq.wallet_address,
          boostRewardIds: txReq.action_payload?.boostRewardIds || undefined,
          txId: detectedTxId,
        });
      } else if (txReq.action_type === 'race_entry_fee') {
        result = await executeRaceEntry({
          raceId: txReq.race_id,
          creatureId: txReq.creature_id,
          walletAddress: txReq.wallet_address,
          txId: detectedTxId,
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
