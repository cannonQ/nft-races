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
const HOUSE_WALLET = '9gbgJTNXUcdqRp2Tq8hjwnw8B5qvFSWFgDbuDKRRsNjUPjgC3vm';
const MIN_BOX_VALUE = 1000000n; // 0.001 ERG minimum box value
const TX_FEE = 1100000n; // 0.0011 ERG recommended tx fee

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

// ============================================
// Transaction-Based Race Entry
// ============================================

export interface RaceEntryTxParams {
  raceId: string;
  raceName: string;
  nftTokenId: string;
  entryFeeNanoErg: bigint;
}

export interface RaceEntryTxResult {
  success: boolean;
  txId?: string;
  error?: string;
}

/**
 * Get UTXOs from connected wallet
 */
async function getWalletUtxos(): Promise<any[]> {
  if (!window.ergo) {
    throw new Error('Wallet not connected');
  }

  // Nautilus provides get_utxos method
  const utxos = await (window.ergo as any).get_utxos();
  return utxos || [];
}

/**
 * Get current blockchain height from explorer
 */
async function getCurrentHeight(): Promise<number> {
  try {
    const response = await fetch('https://api.ergoplatform.com/api/v1/blocks?limit=1');
    const data = await response.json();
    return data.items?.[0]?.height || 1200000;
  } catch {
    // Fallback to a reasonable recent height
    return 1200000;
  }
}

/**
 * Encode a string to Ergo constant format (for register values)
 * Uses Coll[Byte] encoding
 */
function encodeStringConstant(str: string): string {
  const bytes = new TextEncoder().encode(str);
  // Format: 0e (Coll[Byte] type) + length as VLQ + bytes as hex
  let lengthHex = '';
  let len = bytes.length;

  // Variable-length quantity encoding for length
  while (len >= 128) {
    lengthHex += ((len & 0x7f) | 0x80).toString(16).padStart(2, '0');
    len >>= 7;
  }
  lengthHex += len.toString(16).padStart(2, '0');

  const bytesHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return '0e' + lengthHex + bytesHex;
}

/**
 * Build and sign a transaction to pay race entry fee
 * Uses Fleet SDK for proper transaction construction
 */
export async function buildAndSignRaceEntryTx(
  params: RaceEntryTxParams
): Promise<RaceEntryTxResult> {
  if (!window.ergo) {
    return { success: false, error: 'Wallet not connected' };
  }

  try {
    // Dynamic import of Fleet SDK (it's a client-side only library)
    const { TransactionBuilder, OutputBuilder, RECOMMENDED_MIN_FEE_VALUE, SAFE_MIN_BOX_VALUE } = await import('@fleet-sdk/core');

    const { raceId, raceName, nftTokenId, entryFeeNanoErg } = params;

    // Get wallet UTXOs and address
    const utxos = await getWalletUtxos();
    const changeAddress = await getWalletAddress();
    const currentHeight = await getCurrentHeight();

    if (utxos.length === 0) {
      return { success: false, error: 'No UTXOs available in wallet' };
    }

    console.log('Building transaction with Fleet SDK');
    console.log('Entry fee:', entryFeeNanoErg.toString(), 'nanoErg');
    console.log('UTXOs available:', utxos.length);
    console.log('Change address:', changeAddress);

    // Build transaction using Fleet SDK
    const unsignedTx = new TransactionBuilder(currentHeight)
      .from(utxos)
      .to(
        new OutputBuilder(entryFeeNanoErg.toString(), HOUSE_WALLET)
          .setAdditionalRegisters({
            R4: encodeStringConstant(raceName),
            R5: encodeStringConstant(nftTokenId),
            R6: encodeStringConstant(Date.now().toString()),
            R7: encodeStringConstant(raceId),
            R8: encodeStringConstant(changeAddress),
          })
      )
      .sendChangeTo(changeAddress)
      .payFee(RECOMMENDED_MIN_FEE_VALUE)
      .build()
      .toEIP12Object();

    console.log('Unsigned TX (EIP-12):', JSON.stringify(unsignedTx, null, 2));

    // Sign transaction with Nautilus
    const signedTx = await window.ergo.sign_tx(unsignedTx);
    console.log('Signed TX:', signedTx);

    // Submit transaction
    const txId = await window.ergo.submit_tx(signedTx);
    console.log('Submitted TX ID:', txId);

    return { success: true, txId };
  } catch (error) {
    console.error('Transaction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transaction failed'
    };
  }
}

// Base58 alphabet used by Ergo
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

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
/**
 * Convert Ergo address to ErgoTree (hex)
 * For P2PK addresses (starting with '9'), decodes the public key and builds ErgoTree
 */
function addressToErgoTree(address: string): string {
  try {
    const decoded = base58Decode(address);

    // First byte is network type + address type
    // For mainnet P2PK: 0x01
    // Bytes 1-33 are the public key (33 bytes compressed)
    // Last 4 bytes are checksum

    if (decoded.length < 38) {
      throw new Error('Address too short');
    }

    const addressType = decoded[0];

    // P2PK address type is 0x01 (mainnet) or 0x11 (testnet)
    if (addressType === 0x01 || addressType === 0x11) {
      // Extract public key (bytes 1-33)
      const publicKey = decoded.slice(1, 34);
      // P2PK ErgoTree: 0008cd + public key hex
      return '0008cd' + bytesToHex(publicKey);
    }

    // For P2SH or other types, we'd need different handling
    // For now, fall back to API for non-P2PK addresses
    throw new Error(`Unsupported address type: ${addressType}`);
  } catch (error) {
    throw new Error(`Failed to convert address to ErgoTree: ${address} - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Submit race entry with transaction payment
 */
export async function submitRaceEntryWithPayment(
  raceId: string,
  raceName: string,
  nftTokenId: string,
  entryFeeNanoErg: bigint,
  apiEndpoint: string = '/api/race/join'
): Promise<{ success: boolean; entryId?: string; txId?: string; error?: string }> {
  // First build and sign the transaction
  const txResult = await buildAndSignRaceEntryTx({
    raceId,
    raceName,
    nftTokenId,
    entryFeeNanoErg,
  });

  if (!txResult.success || !txResult.txId) {
    return { success: false, error: txResult.error || 'Transaction failed' };
  }

  // Get wallet address for API call
  const address = await getWalletAddress();

  // Submit to backend API with transaction ID
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raceId,
      address,
      nftTokenId,
      txId: txResult.txId,
    }),
  });

  const result = await response.json();

  if (result.success) {
    return {
      success: true,
      entryId: result.entryId,
      txId: txResult.txId
    };
  }

  return { success: false, error: result.error };
}
