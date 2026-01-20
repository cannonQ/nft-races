/**
 * Ergo Wallet Client Utilities
 * Frontend wallet connection and message signing
 */

import type {
  SignedRaceEntry,
  RaceSignatureMessage,
  ErgoAPI,
  WalletState,
} from './types';

// ============================================
// Constants
// ============================================

const MESSAGE_PREFIX = 'CYBERPETS-RACE';

// ============================================
// Wallet Connection
// ============================================

/**
 * Check if Nautilus wallet is installed
 */
export function isNautilusInstalled(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.ergoConnector !== 'undefined' &&
         typeof window.ergoConnector.nautilus !== 'undefined';
}

/**
 * Connect to Nautilus wallet
 * Returns the ergo API object if successful
 */
export async function connectNautilus(): Promise<ErgoAPI | null> {
  if (!isNautilusInstalled()) {
    throw new Error('Nautilus wallet is not installed. Please install it from the Chrome Web Store.');
  }

  try {
    const connected = await window.ergoConnector!.nautilus.connect({
      createErgoObject: true,
    });

    if (!connected) {
      throw new Error('User rejected the connection request');
    }

    // Wait a moment for the ergo object to be injected
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!window.ergo) {
      throw new Error('Failed to get ergo API object after connection');
    }

    return window.ergo;
  } catch (error) {
    console.error('Failed to connect to Nautilus:', error);
    throw error;
  }
}

/**
 * Disconnect from Nautilus wallet
 */
export async function disconnectNautilus(): Promise<void> {
  if (window.ergoConnector?.nautilus) {
    await window.ergoConnector.nautilus.disconnect();
  }
}

/**
 * Check if wallet is connected
 */
export async function isWalletConnected(): Promise<boolean> {
  if (!isNautilusInstalled()) return false;
  
  try {
    return await window.ergoConnector!.nautilus.isConnected();
  } catch {
    return false;
  }
}

/**
 * Get the primary (change) address from connected wallet
 */
export async function getWalletAddress(): Promise<string> {
  if (!window.ergo) {
    throw new Error('Wallet not connected');
  }

  return await window.ergo.get_change_address();
}

/**
 * Get all addresses from connected wallet
 */
export async function getAllAddresses(): Promise<string[]> {
  if (!window.ergo) {
    throw new Error('Wallet not connected');
  }

  const used = await window.ergo.get_used_addresses();
  const unused = await window.ergo.get_unused_addresses();
  return [...used, ...unused];
}

/**
 * Get wallet ERG balance in nanoErgs
 */
export async function getBalance(): Promise<bigint> {
  if (!window.ergo) {
    throw new Error('Wallet not connected');
  }

  const balance = await window.ergo.get_balance();
  return BigInt(balance);
}

// ============================================
// Message Signing
// ============================================

/**
 * Create the message string for race entry
 * Format: CYBERPETS-RACE:{raceId}:{nftTokenId}:{timestamp}
 */
export function createRaceMessage(raceId: string, nftTokenId: string): RaceSignatureMessage {
  const timestamp = Date.now();
  return {
    raceId,
    nftTokenId,
    timestamp,
  };
}

/**
 * Convert message object to string format
 */
export function messageToString(msg: RaceSignatureMessage): string {
  return `${MESSAGE_PREFIX}:${msg.raceId}:${msg.nftTokenId}:${msg.timestamp}`;
}

/**
 * Convert string to Uint8Array for signing
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Sign a race entry message with Nautilus wallet
 * 
 * @param address - The address to sign with (must be owned by the wallet)
 * @param raceId - The race ID
 * @param nftTokenId - The NFT token ID being entered
 * @returns SignedRaceEntry with all signature data
 */
export async function signRaceEntry(
  address: string,
  raceId: string,
  nftTokenId: string
): Promise<SignedRaceEntry> {
  if (!window.ergo) {
    throw new Error('Wallet not connected. Call connectNautilus() first.');
  }

  // Create and format the message
  const msgObj = createRaceMessage(raceId, nftTokenId);
  const messageString = messageToString(msgObj);
  const message = stringToBytes(messageString);

  console.log('Signing message:', messageString);

  // Sign with Nautilus
  // ergo.sign_data returns Uint8Array signature
  const signature = await window.ergo.sign_data(address, message);

  return {
    address,
    message,
    messageString,
    signature,
    signatureHex: bytesToHex(signature),
  };
}

// ============================================
// Full Race Entry Flow
// ============================================

/**
 * Complete flow to join a race:
 * 1. Connect wallet (if not connected)
 * 2. Get user's address
 * 3. Sign the race message
 * 4. Return data ready to submit to backend
 */
export async function prepareRaceEntry(
  raceId: string,
  nftTokenId: string
): Promise<{
  address: string;
  message: string;
  signature: string;
}> {
  // Ensure wallet is connected
  const connected = await isWalletConnected();
  if (!connected) {
    await connectNautilus();
  }

  // Get user's primary address
  const address = await getWalletAddress();

  // Sign the race entry
  const signed = await signRaceEntry(address, raceId, nftTokenId);

  return {
    address: signed.address,
    message: signed.messageString,
    signature: signed.signatureHex,
  };
}

/**
 * Submit race entry to backend API
 */
export async function submitRaceEntry(
  raceId: string,
  nftTokenId: string,
  apiEndpoint: string = '/api/race/join'
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  const entry = await prepareRaceEntry(raceId, nftTokenId);

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raceId,
      address: entry.address,
      nftTokenId,
      message: entry.message,
      signature: entry.signature,
    }),
  });

  return await response.json();
}

// ============================================
// Wallet State Helper
// ============================================

/**
 * Get current wallet state
 */
export async function getWalletState(): Promise<WalletState> {
  const state: WalletState = {
    connected: false,
    address: null,
    addresses: [],
    balance: null,
    loading: false,
    error: null,
  };

  try {
    if (!isNautilusInstalled()) {
      state.error = 'Nautilus wallet not installed';
      return state;
    }

    state.connected = await isWalletConnected();
    
    if (state.connected && window.ergo) {
      state.address = await getWalletAddress();
      state.addresses = await getAllAddresses();
      const balance = await getBalance();
      state.balance = {
        address: state.address,
        nanoErgs: balance,
        tokens: [], // Would need additional API calls to populate
      };
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return state;
}
