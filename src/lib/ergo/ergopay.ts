/**
 * ErgoPay (mobile wallet) frontend helpers.
 *
 * Handles the address-prompt flow:
 * 1. initErgoPaySession() → creates a session, returns ergopay:// URL for QR/deep-link
 * 2. pollErgoPayStatus() → polls until the wallet responds with an address
 */

export interface ErgoPaySession {
  sessionId: string;
  ergoPayUrl: string;
  expiresAt: string;
}

export type ErgoPayStatus =
  | { status: 'pending' }
  | { status: 'connected'; address: string }
  | { status: 'expired' }
  | { status: 'not_found' };

export async function initErgoPaySession(): Promise<ErgoPaySession> {
  const resp = await fetch('/api/v2/ergopay/init', { method: 'POST' });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to create ErgoPay session');
  }
  return resp.json();
}

export async function pollErgoPayStatus(sessionId: string): Promise<ErgoPayStatus> {
  const resp = await fetch(`/api/v2/ergopay/status/${sessionId}`);
  if (!resp.ok) {
    throw new Error('Failed to check ErgoPay session status');
  }
  return resp.json();
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent
  );
}
