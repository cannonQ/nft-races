/**
 * Ergo Server Utilities
 * Backend signature verification and NFT ownership checks
 * 
 * Uses ergo-lib-wasm-nodejs for signature verification
 * Uses Ergo Explorer API for balance/token queries
 */

import type {
  VerificationResult,
  NFTOwnershipResult,
  ExplorerBalanceResponse,
} from './types';

// ============================================
// Dynamic Import for ergo-lib-wasm-nodejs
// ============================================

// ergo-lib-wasm-nodejs is a WASM module that needs special handling in Next.js
// We use dynamic import to avoid issues with SSR

let ergoWasm: typeof import('ergo-lib-wasm-nodejs') | null = null;

async function getErgoWasm() {
  if (!ergoWasm) {
    // Dynamic import - this runs only on server
    ergoWasm = await import('ergo-lib-wasm-nodejs');
  }
  return ergoWasm;
}

// ============================================
// Constants
// ============================================

// Public Explorer API endpoints
const EXPLORER_API_V1 = 'https://api.ergoplatform.com/api/v1';

// Alternative explorers (fallback)
const EXPLORER_FALLBACKS = [
  'https://api.ergoplatform.com/api/v1',
  'https://explore.sigmaspace.io/api/v1',
];

// Message format for validation
const MESSAGE_PREFIX = 'CYBERPETS-RACE';
const MESSAGE_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

// ============================================
// Signature Verification
// ============================================

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert string to Uint8Array
 */
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Parse the message string to extract components
 * Format: CYBERPETS-RACE:{raceId}:{nftTokenId}:{timestamp}
 */
export function parseMessage(message: string): {
  valid: boolean;
  raceId?: string;
  nftTokenId?: string;
  timestamp?: number;
  error?: string;
} {
  const parts = message.split(':');
  
  if (parts.length !== 4) {
    return { valid: false, error: 'Invalid message format: expected 4 parts' };
  }

  const [prefix, raceId, nftTokenId, timestampStr] = parts;

  if (prefix !== MESSAGE_PREFIX) {
    return { valid: false, error: `Invalid message prefix: expected ${MESSAGE_PREFIX}` };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, error: 'Invalid timestamp in message' };
  }

  return {
    valid: true,
    raceId,
    nftTokenId,
    timestamp,
  };
}

/**
 * Verify a signature from an Ergo address
 * 
 * @param address - The Ergo address that allegedly signed the message
 * @param message - The original message string
 * @param signatureHex - The signature in hex format
 * @returns VerificationResult
 */
export async function verifySignature(
  address: string,
  message: string,
  signatureHex: string
): Promise<VerificationResult> {
  try {
    const wasm = await getErgoWasm();
    
    // Convert inputs to proper format
    const messageBytes = stringToBytes(message);
    const signatureBytes = hexToBytes(signatureHex);

    // Use ergo-lib-wasm-nodejs verify_signature
    // verify_signature(address: string, message: Uint8Array, signature: Uint8Array) => boolean
    const isValid = wasm.verify_signature(
      address,
      messageBytes,
      signatureBytes
    );

    return {
      isValid,
      address,
      message,
    };
  } catch (error) {
    console.error('Signature verification failed:', error);
    return {
      isValid: false,
      address,
      message,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Verify signature with additional validation checks
 * - Validates message format
 * - Checks timestamp is recent (within MESSAGE_VALIDITY_MS)
 * - Verifies cryptographic signature
 */
export async function verifyRaceSignature(
  address: string,
  message: string,
  signatureHex: string,
  expectedRaceId: string,
  expectedNftTokenId: string
): Promise<{
  valid: boolean;
  error?: string;
}> {
  // 1. Parse and validate message format
  const parsed = parseMessage(message);
  if (!parsed.valid) {
    return { valid: false, error: parsed.error };
  }

  // 2. Verify message matches expected values
  if (parsed.raceId !== expectedRaceId) {
    return { valid: false, error: 'Race ID mismatch' };
  }

  if (parsed.nftTokenId !== expectedNftTokenId) {
    return { valid: false, error: 'NFT Token ID mismatch' };
  }

  // 3. Check timestamp is recent (prevent replay attacks)
  const now = Date.now();
  const messageAge = now - (parsed.timestamp || 0);
  if (messageAge > MESSAGE_VALIDITY_MS) {
    return { 
      valid: false, 
      error: `Message expired: ${Math.round(messageAge / 1000)}s old, max ${MESSAGE_VALIDITY_MS / 1000}s` 
    };
  }

  if (messageAge < 0) {
    return { valid: false, error: 'Message timestamp is in the future' };
  }

  // 4. Verify cryptographic signature
  const verification = await verifySignature(address, message, signatureHex);
  if (!verification.isValid) {
    return { 
      valid: false, 
      error: verification.error || 'Invalid signature' 
    };
  }

  return { valid: true };
}

// ============================================
// NFT Ownership Verification
// ============================================

/**
 * Fetch address balance from Explorer API
 */
async function fetchAddressBalance(
  address: string,
  apiBase: string = EXPLORER_API_V1
): Promise<ExplorerBalanceResponse | null> {
  try {
    const response = await fetch(
      `${apiBase}/addresses/${address}/balance/confirmed`,
      {
        headers: {
          'Accept': 'application/json',
        },
        // Next.js fetch caching options
        next: { revalidate: 30 }, // Cache for 30 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`Explorer API returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch balance from ${apiBase}:`, error);
    return null;
  }
}

/**
 * Fetch address balance with fallback to alternative explorers
 */
async function fetchAddressBalanceWithFallback(
  address: string
): Promise<ExplorerBalanceResponse | null> {
  for (const apiBase of EXPLORER_FALLBACKS) {
    const balance = await fetchAddressBalance(address, apiBase);
    if (balance) {
      return balance;
    }
  }
  return null;
}

/**
 * Check if an address owns a specific NFT token
 * 
 * @param address - The Ergo address to check
 * @param tokenId - The NFT token ID to look for
 * @returns NFTOwnershipResult
 */
export async function verifyNFTOwnership(
  address: string,
  tokenId: string
): Promise<NFTOwnershipResult> {
  try {
    const balance = await fetchAddressBalanceWithFallback(address);

    if (!balance) {
      throw new Error('Failed to fetch address balance from any explorer');
    }

    // Find the token in the balance
    const token = balance.tokens.find(t => t.tokenId === tokenId);

    return {
      ownsToken: token !== undefined && token.amount > 0,
      tokenId,
      address,
      amount: token?.amount || 0,
    };
  } catch (error) {
    console.error('NFT ownership verification failed:', error);
    return {
      ownsToken: false,
      tokenId,
      address,
      amount: 0,
    };
  }
}

/**
 * Verify NFT ownership for a CyberPets NFT specifically
 * Can add additional validation for CyberPets collection
 */
export async function verifyCyberPetsOwnership(
  address: string,
  tokenId: string,
  collectionTokenIds?: string[] // Optional: list of valid CyberPets token IDs
): Promise<{
  valid: boolean;
  error?: string;
  amount: number;
}> {
  // Check if tokenId is from CyberPets collection (if collection list provided)
  if (collectionTokenIds && collectionTokenIds.length > 0) {
    if (!collectionTokenIds.includes(tokenId)) {
      return {
        valid: false,
        error: 'Token is not a valid CyberPets NFT',
        amount: 0,
      };
    }
  }

  // Verify ownership
  const ownership = await verifyNFTOwnership(address, tokenId);

  if (!ownership.ownsToken) {
    return {
      valid: false,
      error: 'Address does not own this NFT',
      amount: 0,
    };
  }

  return {
    valid: true,
    amount: ownership.amount,
  };
}

// ============================================
// Complete Race Entry Verification
// ============================================

/**
 * Complete verification for a race entry:
 * 1. Verify signature authenticity
 * 2. Validate message format and freshness
 * 3. Confirm NFT ownership
 */
export async function verifyRaceEntry(
  address: string,
  message: string,
  signatureHex: string,
  raceId: string,
  nftTokenId: string,
  cyberPetsCollection?: string[]
): Promise<{
  valid: boolean;
  error?: string;
}> {
  // 1. Verify signature and message
  const signatureResult = await verifyRaceSignature(
    address,
    message,
    signatureHex,
    raceId,
    nftTokenId
  );

  if (!signatureResult.valid) {
    return signatureResult;
  }

  // 2. Verify NFT ownership
  const ownershipResult = await verifyCyberPetsOwnership(
    address,
    nftTokenId,
    cyberPetsCollection
  );

  if (!ownershipResult.valid) {
    return {
      valid: false,
      error: ownershipResult.error || 'NFT ownership verification failed',
    };
  }

  return { valid: true };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Validate an Ergo address format
 */
export async function isValidErgoAddress(address: string): Promise<boolean> {
  try {
    const wasm = await getErgoWasm();
    // Try to create an address object - will throw if invalid
    wasm.Address.from_base58(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get address type (P2PK, P2SH, etc.)
 */
export async function getAddressType(address: string): Promise<string | null> {
  try {
    const wasm = await getErgoWasm();
    const addr = wasm.Address.from_base58(address);
    // Address types in ergo-lib-wasm
    const addrType = addr.address_type_prefix();
    return addrType.toString();
  } catch {
    return null;
  }
}
