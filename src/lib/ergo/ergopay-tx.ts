/**
 * ErgoPay transaction payment helpers.
 *
 * Handles the payment flow for ErgoPay/Terminus wallet users:
 * 1. requestErgoPayTx() → creates a payment request, returns ergopay:// URL for QR/deep-link
 * 2. pollErgoPayTxStatus() → polls until payment confirmed and game action executed
 */

import { API_BASE } from '@/api/config';

export interface ErgoPayTxRequest {
  requestId: string;
  ergoPayUrl: string;
  amount: number;
}

export type ErgoPayTxStatus =
  | { status: 'pending' }
  | { status: 'executed'; txId: string; result: any }
  | { status: 'expired' }
  | { status: 'failed'; error: string };

export interface RequestErgoPayTxParams {
  actionType: 'training_fee' | 'race_entry_fee';
  walletAddress: string;
  creatureId: string;
  raceId?: string;
  activity?: string;
  boostRewardIds?: string[];
}

export async function requestErgoPayTx(params: RequestErgoPayTxParams): Promise<ErgoPayTxRequest> {
  const resp = await fetch(`${API_BASE}/ergopay/tx/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Failed to create payment request (HTTP ${resp.status})`);
  }

  return resp.json();
}

export async function pollErgoPayTxStatus(requestId: string): Promise<ErgoPayTxStatus> {
  const resp = await fetch(`${API_BASE}/ergopay/tx/status/${requestId}`);

  if (!resp.ok) {
    throw new Error('Failed to check payment status');
  }

  return resp.json();
}
