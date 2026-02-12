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
  | 'admin_credit';

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
}

/**
 * Record a shadow billing ledger entry.
 * Fire-and-forget: logs errors but never throws.
 * Primary actions (training, race entry, etc.) are never disrupted by a ledger failure.
 */
export async function recordLedgerEntry(entry: LedgerEntry): Promise<void> {
  try {
    // Read current balance from latest entry (or 0 if first)
    const { data: latest } = await supabase
      .from('credit_ledger')
      .select('balance_after_nanoerg')
      .eq('owner_address', entry.ownerAddress)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

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
      shadow: true,
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
 */
export async function getWalletBalance(ownerAddress: string): Promise<number> {
  const { data } = await supabase
    .from('credit_ledger')
    .select('balance_after_nanoerg')
    .eq('owner_address', ownerAddress)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data?.balance_after_nanoerg ?? 0;
}
