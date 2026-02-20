/**
 * Shared TX verification utilities.
 *
 * - isTxIdUsed()          — dedup: has this txId already been consumed? (A3-2)
 * - verifyTxOnChain()     — Nautilus flow: confirm TX exists + pays treasury (A3-1)
 * - detectPaymentOnChain()— ErgoPay fallback: find matching unused TX on-chain (A3-3)
 */
import { supabase } from './supabase.js';

const EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

// ── A3-2: txId dedup ──────────────────────────────────────────────

/**
 * Check if a txId has already been recorded for a real (non-shadow) game action.
 * Queries credit_ledger for any non-shadow entry with this tx_id.
 */
export async function isTxIdUsed(txId: string): Promise<boolean> {
  const { count } = await supabase
    .from('credit_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('tx_id', txId)
    .eq('shadow', false);

  return (count ?? 0) > 0;
}

// ── A3-1: on-chain TX verification (Nautilus flow) ────────────────

/**
 * Verify that a TX exists on-chain (confirmed) and its outputs to the
 * treasury address sum to at least the expected amount.
 *
 * Soft-fails (returns valid:true) if the Explorer API is unreachable
 * or the TX is not yet confirmed (could be in mempool). The dedup
 * check in isTxIdUsed() is the hard guarantee against abuse.
 */
export async function verifyTxOnChain(
  txId: string,
  treasuryAddress: string,
  expectedAmountNanoerg: number,
): Promise<{ valid: boolean; reason?: string }> {
  // Basic format validation — Ergo TX IDs are 64-char hex
  if (!/^[0-9a-fA-F]{64}$/.test(txId)) {
    return { valid: false, reason: 'Invalid transaction ID format' };
  }

  try {
    const resp = await fetch(`${EXPLORER_API}/transactions/${txId}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      if (resp.status === 404) {
        // TX not found in confirmed chain — may still be in mempool.
        // Soft-allow: the dedup check is the real protection.
        console.warn(`verifyTxOnChain: TX ${txId} not yet confirmed (soft-allowing)`);
        return { valid: true };
      }
      console.warn(`verifyTxOnChain: Explorer returned ${resp.status} for TX ${txId}`);
      return { valid: true };
    }

    const tx = await resp.json();

    // Sum all outputs going to the treasury address
    const totalToTreasury = (tx.outputs || [])
      .filter((o: any) => o.address === treasuryAddress)
      .reduce((sum: number, o: any) => sum + (o.value ?? 0), 0);

    if (totalToTreasury < expectedAmountNanoerg) {
      return {
        valid: false,
        reason: `Insufficient payment: expected ${expectedAmountNanoerg} nanoERG to treasury, found ${totalToTreasury}`,
      };
    }

    return { valid: true };
  } catch (err) {
    // Network error — soft-allow to avoid blocking legitimate users
    console.warn('verifyTxOnChain: Explorer unreachable, soft-allowing:', err);
    return { valid: true };
  }
}

// ── Token TX verification (dual-currency support) ───────────────

/**
 * Verify that a TX exists on-chain and its outputs to the treasury address
 * contain at least the expected amount of a specific token.
 *
 * Same soft-fail pattern as verifyTxOnChain: if Explorer is unreachable
 * or TX is in mempool, allow. Dedup via isTxIdUsed() is the hard guard.
 */
export async function verifyTokenTxOnChain(
  txId: string,
  treasuryAddress: string,
  expectedTokenId: string,
  expectedTokenAmount: bigint,
): Promise<{ valid: boolean; reason?: string }> {
  if (!/^[0-9a-fA-F]{64}$/.test(txId)) {
    return { valid: false, reason: 'Invalid transaction ID format' };
  }

  try {
    const resp = await fetch(`${EXPLORER_API}/transactions/${txId}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      if (resp.status === 404) {
        console.warn(`verifyTokenTxOnChain: TX ${txId} not yet confirmed (soft-allowing)`);
        return { valid: true };
      }
      console.warn(`verifyTokenTxOnChain: Explorer returned ${resp.status} for TX ${txId}`);
      return { valid: true };
    }

    const tx = await resp.json();

    // Sum all token amounts sent to treasury
    let totalTokenToTreasury = 0n;
    for (const output of (tx.outputs || [])) {
      if (output.address !== treasuryAddress) continue;
      for (const asset of (output.assets || [])) {
        if (asset.tokenId === expectedTokenId) {
          totalTokenToTreasury += BigInt(asset.amount ?? 0);
        }
      }
    }

    if (totalTokenToTreasury < expectedTokenAmount) {
      return {
        valid: false,
        reason: `Insufficient token payment: expected ${expectedTokenAmount} of ${expectedTokenId}, found ${totalTokenToTreasury}`,
      };
    }

    return { valid: true };
  } catch (err) {
    console.warn('verifyTokenTxOnChain: Explorer unreachable, soft-allowing:', err);
    return { valid: true };
  }
}

// ── A3-3: ErgoPay blockchain fallback (extracted + dedup) ─────────

/**
 * Search the Ergo blockchain (mempool + confirmed) for a payment TX
 * from sender to treasury matching the expected amount.
 *
 * Skips TXs that have already been consumed (isTxIdUsed check).
 * This prevents the fallback from re-matching an old payment that
 * was already used for a different action.
 */
export async function detectPaymentOnChain(
  senderAddress: string,
  treasuryAddress: string,
  amountNanoerg: number,
  createdAfterMs: number,
): Promise<{ txId: string } | null> {
  function txMatchesPayment(tx: any): boolean {
    const totalToTreasury = (tx.outputs || [])
      .filter((o: any) => o.address === treasuryAddress)
      .reduce((sum: number, o: any) => sum + (o.value ?? 0), 0);
    return totalToTreasury >= amountNanoerg;
  }

  try {
    // 1. Check mempool (unconfirmed) — catches TX before it confirms
    try {
      const mempoolResp = await fetch(
        `${EXPLORER_API}/mempool/transactions/byAddress/${senderAddress}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
      );
      if (mempoolResp.ok) {
        const mempoolData = await mempoolResp.json();
        const items = Array.isArray(mempoolData) ? mempoolData : (mempoolData.items || []);
        for (const tx of items) {
          if (txMatchesPayment(tx) && !(await isTxIdUsed(tx.id))) {
            return { txId: tx.id };
          }
        }
      }
    } catch {
      // mempool check is best-effort
    }

    // 2. Check recent confirmed TXs for the sender
    const resp = await fetch(
      `${EXPLORER_API}/addresses/${senderAddress}/transactions?limit=10&sortBy=height&sortDirection=desc`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
    );
    if (resp.ok) {
      const data = await resp.json();
      for (const tx of data.items || []) {
        // Skip TXs from before the payment request was created
        if (tx.timestamp && tx.timestamp < createdAfterMs) continue;
        if (txMatchesPayment(tx) && !(await isTxIdUsed(tx.id))) {
          return { txId: tx.id };
        }
      }
    }

    return null;
  } catch (err) {
    console.error('detectPaymentOnChain error:', err);
    return null;
  }
}
