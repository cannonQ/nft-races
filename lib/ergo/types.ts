/**
 * Ergo Wallet Integration Types
 * For CyberPets Racing Game
 */

// ============================================
// Message Signing Types
// ============================================

export interface RaceSignatureMessage {
  raceId: string;
  nftTokenId: string;
  timestamp: number;
}

export interface SignedRaceEntry {
  address: string;
  message: Uint8Array;
  messageString: string; // Human-readable format: "CYBERPETS-RACE:{raceId}:{nftTokenId}:{timestamp}"
  signature: Uint8Array;
  signatureHex: string;
}

export interface VerificationResult {
  isValid: boolean;
  address: string;
  message: string;
  error?: string;
}

// ============================================
// NFT Ownership Types
// ============================================

export interface TokenBalance {
  tokenId: string;
  amount: number;
  name?: string;
  decimals?: number;
}

export interface AddressBalance {
  address: string;
  nanoErgs: bigint;
  tokens: TokenBalance[];
}

export interface NFTOwnershipResult {
  ownsToken: boolean;
  tokenId: string;
  address: string;
  amount: number;
}

// ============================================
// Explorer API Response Types
// ============================================

export interface ExplorerBalanceResponse {
  nanoErgs: number;
  tokens: Array<{
    tokenId: string;
    amount: number;
    decimals: number;
    name: string;
    tokenType?: string;
  }>;
}

export interface ExplorerBoxResponse {
  boxId: string;
  transactionId: string;
  value: number;
  assets: Array<{
    tokenId: string;
    amount: number;
  }>;
  ergoTree: string;
  address: string;
  creationHeight: number;
}

// ============================================
// Wallet Connection Types
// ============================================

export interface WalletState {
  connected: boolean;
  address: string | null;
  addresses: string[];
  balance: AddressBalance | null;
  loading: boolean;
  error: string | null;
}

export interface ErgoConnector {
  nautilus: {
    connect: (options?: { createErgoObject?: boolean }) => Promise<boolean>;
    disconnect: () => Promise<boolean>;
    isConnected: () => Promise<boolean>;
  };
}

export interface ErgoAPI {
  get_balance: (tokenId?: string) => Promise<string>;
  get_used_addresses: () => Promise<string[]>;
  get_unused_addresses: () => Promise<string[]>;
  get_change_address: () => Promise<string>;
  sign_data: (address: string, data: Uint8Array) => Promise<Uint8Array>;
  sign_tx: (tx: unknown) => Promise<unknown>;
  submit_tx: (signedTx: unknown) => Promise<string>;
}

// ============================================
// Race Entry Types (for Supabase)
// ============================================

export interface RaceEntry {
  id: string;
  race_id: string;
  address: string;
  nft_token_id: string;
  signature: string;
  message: string;
  verified_at: string;
  created_at: string;
}

export interface Race {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed';
  start_time: string;
  end_time?: string;
  seed?: string; // For provably fair random generation
  created_at: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface JoinRaceRequest {
  raceId: string;
  address: string;
  nftTokenId: string;
  message: string;
  signature: string; // hex encoded
}

export interface JoinRaceResponse {
  success: boolean;
  entryId?: string;
  error?: string;
}

// ============================================
// Global Type Declarations
// ============================================

declare global {
  interface Window {
    ergoConnector?: ErgoConnector;
    ergo?: ErgoAPI;
  }
}

export {};
