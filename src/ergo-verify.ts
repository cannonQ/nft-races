/**
 * Ergo Wallet Signature Verification (Server-Side)
 *
 * Uses ergo-lib-wasm-nodejs for real signature verification.
 * This file is ONLY imported by Vercel serverless API handlers.
 * DO NOT import in client-side code — WASM will fail in browser bundle.
 */

// ============================================
// Types
// ============================================

export interface SignatureVerification {
  valid: boolean;
  address?: string;
  error?: string;
}

// ============================================
// WASM Lazy Loader
// ============================================

let ergoWasm: any = null;

async function getErgoWasm() {
  if (!ergoWasm) {
    ergoWasm = await import('ergo-lib-wasm-nodejs');
  }
  return ergoWasm;
}

// ============================================
// Byte Helpers (duplicated from client to avoid importing client code)
// ============================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ============================================
// Signing Message
// ============================================

/**
 * Message format for race entry signing.
 * Format: CYBERPETS-RACE:{raceId}:{nftTokenId}:{timestamp}
 */
export function createSigningMessage(
  raceId: string,
  nftTokenId: string,
  timestamp?: number
): string {
  const ts = timestamp ?? Date.now();
  return `CYBERPETS-RACE:${raceId}:${nftTokenId}:${ts}`;
}

/**
 * Parse and validate a signed message string.
 * Returns the parts or null if invalid format.
 */
export function parseSignedMessage(
  message: string
): { prefix: string; action: string; address: string; timestamp: number } | null {
  const parts = message.split(':');
  if (parts.length < 3) return null;

  // Support both formats:
  // CYBERPETS-RACE:{raceId}:{nftTokenId}:{timestamp}
  // CYBERPETS:{action}:{address}:{timestamp}
  const prefix = parts[0];
  if (prefix !== 'CYBERPETS' && prefix !== 'CYBERPETS-RACE') return null;

  const timestamp = parseInt(parts[parts.length - 1], 10);
  if (isNaN(timestamp)) return null;

  return {
    prefix,
    action: parts[1],
    address: parts[2],
    timestamp,
  };
}

// ============================================
// Signature Verification
// ============================================

/**
 * Verify an Ergo signature using ergo-lib-wasm-nodejs.
 */
export async function verifyErgoSignature(
  message: string,
  signatureHex: string,
  expectedAddress: string
): Promise<SignatureVerification> {
  try {
    const wasm = await getErgoWasm();
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = hexToBytes(signatureHex);

    // ergo-lib-wasm-nodejs verify_signature function
    const address = wasm.Address.from_base58(expectedAddress);
    const isValid = address.verify_signature(messageBytes, signatureBytes);

    return {
      valid: isValid,
      address: expectedAddress,
    };
  } catch (error) {
    console.error('Signature verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Validate that a string is a valid Ergo address.
 */
export async function isValidErgoAddress(address: string): Promise<boolean> {
  try {
    const wasm = await getErgoWasm();
    wasm.Address.from_base58(address);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Timestamp Validation (replay attack prevention)
// ============================================

const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function isTimestampValid(timestamp: number): boolean {
  const age = Date.now() - timestamp;
  return age >= 0 && age <= MAX_MESSAGE_AGE_MS;
}

// ============================================
// NFT Ownership Verification (via Explorer API)
// ============================================

const EXPLORER_URLS = [
  'https://api.ergoplatform.com',
  'https://api-testnet.ergoplatform.com',
];

export async function verifyNftOwnership(
  nftTokenId: string,
  claimedOwnerAddress: string
): Promise<{ owns: boolean; currentOwner?: string }> {
  for (const baseUrl of EXPLORER_URLS) {
    try {
      const response = await fetch(
        `${baseUrl}/api/v1/tokens/${nftTokenId}/boxes?limit=1`
      );

      if (!response.ok) continue;

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        return { owns: false, currentOwner: undefined };
      }

      const currentBox = data.items[0];
      const currentOwner = currentBox.address;

      return {
        owns: currentOwner === claimedOwnerAddress,
        currentOwner,
      };
    } catch {
      continue; // Try next explorer
    }
  }

  console.error('All explorer APIs failed for NFT ownership check');
  return { owns: false };
}

// ============================================
// Full Entry Verification
// ============================================

/**
 * Full race entry verification: signature + timestamp + ownership.
 */
export async function verifyRaceEntry(
  raceId: string,
  nftTokenId: string,
  signature: string,
  claimedOwnerAddress: string,
  messageString?: string
): Promise<{ valid: boolean; error?: string }> {
  // 1. Parse and validate message
  if (messageString) {
    const parsed = parseSignedMessage(messageString);
    if (!parsed) {
      return { valid: false, error: 'Invalid message format' };
    }
    if (!isTimestampValid(parsed.timestamp)) {
      return { valid: false, error: 'Message timestamp expired (>5 minutes)' };
    }
  }

  // 2. Verify signature
  const message =
    messageString || createSigningMessage(raceId, nftTokenId);
  const sigResult = await verifyErgoSignature(
    message,
    signature,
    claimedOwnerAddress
  );

  if (!sigResult.valid) {
    return { valid: false, error: `Invalid signature: ${sigResult.error}` };
  }

  // 3. Verify ownership
  const ownershipResult = await verifyNftOwnership(
    nftTokenId,
    claimedOwnerAddress
  );

  if (!ownershipResult.owns) {
    return {
      valid: false,
      error: `NFT not owned by claimed address. Current owner: ${ownershipResult.currentOwner}`,
    };
  }

  return { valid: true };
}

/**
 * Verify auth headers from an API request.
 * Checks X-Ergo-Address, X-Ergo-Message, X-Ergo-Signature, X-Ergo-Timestamp.
 */
export async function verifyAuthHeaders(
  headers: Record<string, string | undefined>
): Promise<{ valid: boolean; address?: string; error?: string }> {
  const address = headers['x-ergo-address'];
  const message = headers['x-ergo-message'];
  const signature = headers['x-ergo-signature'];
  const timestamp = headers['x-ergo-timestamp'];

  if (!address || !message || !signature || !timestamp) {
    return { valid: false, error: 'Missing auth headers' };
  }

  // Validate timestamp
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || !isTimestampValid(ts)) {
    return { valid: false, error: 'Auth timestamp expired' };
  }

  // Verify signature
  const result = await verifyErgoSignature(message, signature, address);
  if (!result.valid) {
    return { valid: false, error: `Invalid signature: ${result.error}` };
  }

  return { valid: true, address };
}
