/**
 * Ergo Wallet Signature Verification
 * Verifies that a signature was produced by the wallet holding the NFT
 */

// Note: In production, use @fleet-sdk/core or ergo-lib-wasm
// This is a simplified interface - actual implementation depends on your Ergo library choice

export interface SignatureVerification {
  valid: boolean;
  address?: string;
  error?: string;
}

/**
 * Message format for race entry signing
 * This is what the user signs with their wallet
 */
export function createSigningMessage(raceId: string, nftTokenId: string): string {
  return `CYBERPETS-RACE:${raceId}:${nftTokenId}`;
}

/**
 * Verify an Ergo signature
 * 
 * In production, implement using:
 * - @fleet-sdk/core for signature verification
 * - ergo-lib-wasm for lower-level operations
 */
export async function verifyErgoSignature(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<SignatureVerification> {
  try {
    // TODO: Implement actual Ergo signature verification
    // 
    // Example with fleet-sdk (pseudocode):
    // import { verify } from '@fleet-sdk/crypto';
    // const messageBytes = Buffer.from(message, 'utf-8');
    // const sigBytes = Buffer.from(signature, 'hex');
    // const isValid = verify(messageBytes, sigBytes, expectedAddress);
    
    // For now, return a placeholder
    // REMOVE THIS IN PRODUCTION
    console.warn('⚠️ Signature verification not implemented - accepting all signatures');
    
    return {
      valid: true,
      address: expectedAddress
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error'
    };
  }
}

/**
 * Verify NFT ownership via Ergo explorer API
 */
export async function verifyNftOwnership(
  nftTokenId: string,
  claimedOwnerAddress: string
): Promise<{ owns: boolean; currentOwner?: string }> {
  try {
    // Query Ergo explorer for current token holder
    const response = await fetch(
      `https://api.ergoplatform.com/api/v1/tokens/${nftTokenId}/boxes?limit=1`
    );
    
    if (!response.ok) {
      throw new Error(`Explorer API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return { owns: false, currentOwner: undefined };
    }
    
    // Get the address from the current unspent box
    const currentBox = data.items[0];
    const currentOwner = currentBox.address;
    
    return {
      owns: currentOwner === claimedOwnerAddress,
      currentOwner
    };
  } catch (error) {
    console.error('NFT ownership verification failed:', error);
    return { owns: false };
  }
}

/**
 * Full entry verification: signature + ownership
 */
export async function verifyRaceEntry(
  raceId: string,
  nftTokenId: string,
  signature: string,
  claimedOwnerAddress: string
): Promise<{ valid: boolean; error?: string }> {
  // 1. Verify signature
  const message = createSigningMessage(raceId, nftTokenId);
  const sigResult = await verifyErgoSignature(message, signature, claimedOwnerAddress);
  
  if (!sigResult.valid) {
    return { valid: false, error: `Invalid signature: ${sigResult.error}` };
  }
  
  // 2. Verify ownership
  const ownershipResult = await verifyNftOwnership(nftTokenId, claimedOwnerAddress);
  
  if (!ownershipResult.owns) {
    return { 
      valid: false, 
      error: `NFT not owned by claimed address. Current owner: ${ownershipResult.currentOwner}` 
    };
  }
  
  return { valid: true };
}
