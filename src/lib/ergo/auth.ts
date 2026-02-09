/**
 * Ergo Auth Helpers — signed request headers for authenticated API calls
 */

import { signMessage } from './client';

/**
 * Create signed auth headers for API requests.
 * The server can verify these using ergo-lib-wasm-nodejs.
 */
export async function createAuthHeaders(
  address: string,
  action: string
): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();
  const message = `CYBERPETS:${action}:${address}:${timestamp}`;
  const { signatureHex } = await signMessage(address, message);

  return {
    'X-Ergo-Address': address,
    'X-Ergo-Message': message,
    'X-Ergo-Signature': signatureHex,
    'X-Ergo-Timestamp': timestamp,
  };
}
