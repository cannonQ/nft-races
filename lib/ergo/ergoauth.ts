/**
 * ErgoAuth Integration for Mobile Wallets (Terminus)
 *
 * ErgoAuth (EIP-28) enables QR code-based message signing
 * for mobile wallets like Terminus without requiring a browser extension.
 *
 * Flow:
 * 1. dApp generates ErgoAuthRequest with unique session + message
 * 2. User scans QR code with mobile wallet (ergoauth:// URI)
 * 3. Wallet fetches request, signs message, POSTs to replyToUrl
 * 4. dApp validates signature and proceeds
 */

import type { VerificationResult } from './types';
import crypto from 'crypto';

// ============================================
// Types
// ============================================

export interface ErgoAuthRequest {
  signingMessage: string;        // Message to sign (your race entry message)
  sigmaBoolean: string;          // Hex-encoded serialized SigmaProp (ProveDlog for P2PK)
  userMessage?: string;          // Human-readable message shown to user
  messageSeverity?: 'INFORMATION' | 'WARNING';
  replyToUrl: string;            // URL where wallet POSTs the response
}

export interface ErgoAuthResponse {
  signedMessage: string;         // Original message + wallet-added bytes
  proof: string;                 // Base64 encoded signature proof
}

export interface ErgoAuthSession {
  id: string;
  raceId: string;
  nftTokenId: string;
  signingMessage: string;
  address: string;               // Expected P2PK address
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'completed' | 'expired';
  response?: ErgoAuthResponse;
}

// ============================================
// Constants
// ============================================

const SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MESSAGE_PREFIX = 'CYBERPETS-RACE';

// Base58 alphabet used by Ergo
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// In-memory session store (use Redis/Supabase in production)
const sessions = new Map<string, ErgoAuthSession>();

// ============================================
// Base58 Decoding
// ============================================

/**
 * Decode base58 string to bytes
 */
function base58Decode(str: string): Uint8Array {
  const bytes: number[] = [];

  for (const char of str) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid base58 character: ${char}`);
    }

    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Handle leading zeros
  for (const char of str) {
    if (char !== '1') break;
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
}

// ============================================
// Session Management
// ============================================

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create the signing message for a race entry
 */
function createSigningMessage(raceId: string, nftTokenId: string): string {
  const timestamp = Date.now();
  return `${MESSAGE_PREFIX}:${raceId}:${nftTokenId}:${timestamp}`;
}

/**
 * Convert P2PK address to SigmaBoolean for ErgoAuth
 *
 * Trying different format: P2PK ErgoTree = 0x0008cd + 33-byte public key
 * This is what the address decodes to and might be what Terminus expects.
 */
export function addressToSigmaBoolean(address: string): string {
  // Decode the base58 address
  const decoded = base58Decode(address);

  // Address format: 1 byte type + 33 bytes public key + 4 bytes checksum = 38 bytes
  if (decoded.length < 38) {
    throw new Error('Invalid address length');
  }

  // Extract the 33-byte compressed public key (bytes 1-33)
  const publicKey = decoded.slice(1, 34);

  // Build P2PK ErgoTree: 0x00 0x08 0xcd + 33-byte public key = 36 bytes
  // This is the standard P2PK ErgoTree format
  const ergoTree = new Uint8Array(36);
  ergoTree[0] = 0x00;  // ErgoTree header (no segregated constants)
  ergoTree[1] = 0x08;  // SigmaProp type
  ergoTree[2] = 0xcd;  // ProveDlog operation code
  ergoTree.set(publicKey, 3);

  // Return as base64 string
  return Buffer.from(ergoTree).toString('base64');
}

/**
 * Create a new ErgoAuth session for race entry
 */
export async function createErgoAuthSession(
  raceId: string,
  nftTokenId: string,
  address: string,
  baseUrl: string
): Promise<{
  sessionId: string;
  qrCodeUrl: string;
  ergoAuthUrl: string;
  request: ErgoAuthRequest;
}> {
  const sessionId = generateSessionId();
  const signingMessage = createSigningMessage(raceId, nftTokenId);
  const sigmaBoolean = addressToSigmaBoolean(address);
  
  // Create session
  const session: ErgoAuthSession = {
    id: sessionId,
    raceId,
    nftTokenId,
    signingMessage,
    address,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRY_MS,
    status: 'pending',
  };
  
  sessions.set(sessionId, session);
  
  // Build the ErgoAuth request
  // The replyToUrl is where the wallet will POST the signed response
  const replyToUrl = `${baseUrl}/api/ergoauth/response/${sessionId}`;
  
  const request: ErgoAuthRequest = {
    signingMessage,
    sigmaBoolean,
    userMessage: `Sign to enter CyberPets Race\n\nRace: ${raceId}\nNFT: ${nftTokenId.slice(0, 8)}...`,
    messageSeverity: 'INFORMATION',
    replyToUrl,
  };
  
  // The ergoauth:// URL format (without https://)
  // Mobile wallet will prepend https:// when fetching
  const requestUrl = `${baseUrl.replace('https://', '')}/api/ergoauth/request/${sessionId}`;
  const ergoAuthUrl = `ergoauth://${requestUrl}`;
  
  return {
    sessionId,
    qrCodeUrl: ergoAuthUrl,  // This goes in the QR code
    ergoAuthUrl,             // This can be a clickable link
    request,
  };
}

/**
 * Get an ErgoAuth session
 */
export function getErgoAuthSession(sessionId: string): ErgoAuthSession | null {
  const session = sessions.get(sessionId);
  
  if (!session) return null;
  
  // Check expiry
  if (Date.now() > session.expiresAt) {
    session.status = 'expired';
    return session;
  }
  
  return session;
}

/**
 * Store the wallet's response for a session
 */
export function setErgoAuthResponse(
  sessionId: string,
  response: ErgoAuthResponse
): boolean {
  const session = sessions.get(sessionId);
  
  if (!session || session.status !== 'pending') {
    return false;
  }
  
  session.response = response;
  session.status = 'completed';
  return true;
}

// ============================================
// Signature Verification (for ErgoAuth responses)
// ============================================

/**
 * Verify an ErgoAuth response
 * 
 * The wallet adds random bytes and the hostname to prevent replay attacks.
 * We need to verify:
 * 1. The signedMessage contains our original signingMessage
 * 2. The signedMessage contains our hostname
 * 3. The proof is valid for the expected address
 */
export async function verifyErgoAuthResponse(
  session: ErgoAuthSession,
  response: ErgoAuthResponse,
  expectedHostname: string
): Promise<VerificationResult> {
  try {
    // 1. Check that signedMessage contains our original message
    if (!response.signedMessage.includes(session.signingMessage)) {
      return {
        isValid: false,
        address: session.address,
        message: session.signingMessage,
        error: 'Signed message does not contain original signing message',
      };
    }
    
    // 2. Check that signedMessage contains our hostname (replay protection)
    if (!response.signedMessage.includes(expectedHostname)) {
      return {
        isValid: false,
        address: session.address,
        message: session.signingMessage,
        error: 'Signed message does not contain expected hostname',
      };
    }
    
    // 3. Verify the cryptographic proof
    // Use ergo-lib-wasm-nodejs for verification
    const ergoWasm = await import('ergo-lib-wasm-nodejs');
    
    const messageBytes = new TextEncoder().encode(response.signedMessage);
    const proofBytes = Buffer.from(response.proof, 'base64');
    
    const address = ergoWasm.Address.from_base58(session.address);
    const isValid = ergoWasm.verify_signature(
      address,
      messageBytes,
      proofBytes
    );
    
    return {
      isValid,
      address: session.address,
      message: session.signingMessage,
      error: isValid ? undefined : 'Invalid signature proof',
    };
  } catch (error) {
    return {
      isValid: false,
      address: session.address,
      message: session.signingMessage,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

// ============================================
// Cleanup
// ============================================

/**
 * Clean up expired sessions (run periodically)
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [id, session] of sessions) {
    if (now > session.expiresAt + 60000) { // Keep for 1 extra minute for debugging
      sessions.delete(id);
      cleaned++;
    }
  }
  
  return cleaned;
}
