/**
 * Ergo Wallet Client — Connection, Detection, and Signing
 *
 * Connection/detection adapted from ergo-wallet-integration/lib/ergo/client.ts
 * Signing adapted from frontend-field-main/ergofunctions/helpers.js
 */

import type { ErgoAPI, SignedMessage, SignedRaceEntry } from './types';

// ============================================
// Wallet Detection & Connection
// ============================================

export function isNautilusInstalled(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.ergoConnector !== 'undefined' &&
    typeof window.ergoConnector.nautilus !== 'undefined'
  );
}

export async function connectNautilus(): Promise<ErgoAPI | null> {
  if (!isNautilusInstalled()) {
    throw new Error('Nautilus wallet is not installed.');
  }

  const connected = await window.ergoConnector!.nautilus.connect({
    createErgoObject: true,
  });

  if (!connected) {
    throw new Error('User rejected the connection request');
  }

  // Wait for the ergo API object to be injected (Nautilus needs a moment)
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (!window.ergo) {
    // Retry once more with a longer delay
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (!window.ergo) {
      throw new Error('Failed to get ergo API object after connection');
    }
  }

  return window.ergo;
}

export async function disconnectNautilus(): Promise<void> {
  if (window.ergoConnector?.nautilus) {
    await window.ergoConnector.nautilus.disconnect();
  }
}

export async function isWalletConnected(): Promise<boolean> {
  if (!isNautilusInstalled()) return false;
  try {
    return await window.ergoConnector!.nautilus.isConnected();
  } catch {
    return false;
  }
}

// ============================================
// Address & Balance
// ============================================

export async function getWalletAddress(): Promise<string> {
  if (!window.ergo) throw new Error('Wallet not connected');
  return await window.ergo.get_change_address();
}

export async function getAllAddresses(): Promise<string[]> {
  if (!window.ergo) throw new Error('Wallet not connected');
  const used = await window.ergo.get_used_addresses();
  const unused = await window.ergo.get_unused_addresses();
  return [...used, ...unused];
}

export async function getBalance(): Promise<string> {
  if (!window.ergo) throw new Error('Wallet not connected');
  return await window.ergo.get_balance();
}

// ============================================
// Byte Helpers
// ============================================

export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ============================================
// Message Signing (using ergo.sign_data — EIP-12)
// ============================================

/**
 * Sign an arbitrary message for authentication.
 * Uses ergo.sign_data (EIP-12 standard).
 */
export async function signMessage(
  address: string,
  message: string
): Promise<SignedMessage> {
  if (!window.ergo) throw new Error('Wallet not connected');

  const messageBytes = stringToBytes(message);
  const signature = await window.ergo.sign_data(address, messageBytes);

  return {
    message,
    signatureHex: bytesToHex(signature),
  };
}

/**
 * Sign a race entry message.
 * Format: CYBERPETS-RACE:{raceId}:{nftTokenId}:{timestamp}
 */
export async function signRaceEntry(
  address: string,
  raceId: string,
  nftTokenId: string
): Promise<SignedRaceEntry> {
  const timestamp = Date.now();
  const message = `CYBERPETS-RACE:${raceId}:${nftTokenId}:${timestamp}`;
  const signed = await signMessage(address, message);

  return {
    address,
    ...signed,
  };
}

// ============================================
// Utilities
// ============================================

export function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
