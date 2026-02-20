/**
 * Shadow billing credit ledger.
 * Records all theoretical debits and credits per wallet address.
 * Phase 1: entries are logged but don't gate any actions.
 */
import { supabase } from './supabase.js';

export type LedgerTxType =
  | 'training_fee'
  | 'race_entry_fee'
  | 'race_payout'
  | 'season_payout'
  | 'deposit'
  | 'withdrawal'
  | 'admin_credit'
  | 'treatment_fee';

export interface LedgerEntry {
  ownerAddress: string;
  txType: LedgerTxType;
  amountNanoerg: number;       // negative = debit, positive = credit
  creatureId?: string;
  raceId?: string;
  seasonId?: string;
  trainingLogId?: string;
  raceEntryId?: string;
  memo?: string;
  txId?: string;               // on-chain transaction ID (when real payment made)
  shadow?: boolean;            // true = no real tx, false = real payment. Defaults to true.
  feeTokenId?: string;         // token ID if paid with token (null = ERG)
  feeTokenAmount?: number;     // amount in token units
}

/**
 * Record a shadow billing ledger entry.
 * Fire-and-forget: logs errors but never throws.
 * Primary actions (training, race entry, etc.) are never disrupted by a ledger failure.
 *
 * B3-3: balance_after_nanoerg is now best-effort (snapshot at insert time).
 * Use getWalletBalance() for the authoritative balance — it uses SUM.
 */
export async function recordLedgerEntry(entry: LedgerEntry): Promise<void> {
  try {
    // Best-effort balance snapshot (may be slightly stale under concurrency — that's OK,
    // getWalletBalance() uses SUM for authoritative reads)
    const { data: latest } = await supabase
      .from('credit_ledger')
      .select('balance_after_nanoerg')
      .eq('owner_address', entry.ownerAddress)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousBalance = latest?.balance_after_nanoerg ?? 0;
    const newBalance = previousBalance + entry.amountNanoerg;

    const { error } = await supabase.from('credit_ledger').insert({
      owner_address: entry.ownerAddress,
      tx_type: entry.txType,
      amount_nanoerg: entry.amountNanoerg,
      balance_after_nanoerg: newBalance,
      creature_id: entry.creatureId ?? null,
      race_id: entry.raceId ?? null,
      season_id: entry.seasonId ?? null,
      training_log_id: entry.trainingLogId ?? null,
      race_entry_id: entry.raceEntryId ?? null,
      memo: entry.memo ?? null,
      shadow: entry.shadow ?? true,
      tx_id: entry.txId ?? null,
      fee_token_id: entry.feeTokenId ?? null,
      fee_token_amount: entry.feeTokenAmount ?? null,
    });

    if (error) {
      console.error('Shadow ledger insert failed:', error);
    }
  } catch (err) {
    console.error('Shadow ledger error:', err);
  }
}

/**
 * Get the current shadow balance for a wallet address.
 * B3-3: Uses SUM(amount_nanoerg) for race-condition-safe balance.
 * This is the authoritative balance — immune to concurrent insert ordering.
 */
export async function getWalletBalance(ownerAddress: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_wallet_balance', {
    p_owner_address: ownerAddress,
  });

  if (error) {
    // Fallback to SUM query if RPC not yet deployed
    const { data: rows } = await supabase
      .from('credit_ledger')
      .select('amount_nanoerg')
      .eq('owner_address', ownerAddress);
    return (rows ?? []).reduce((sum: number, r: any) => sum + (r.amount_nanoerg ?? 0), 0);
  }

  return data ?? 0;
}
