/**
 * Ergo Wallet Types for CyberPets Racing
 */

// ============================================
// Wallet Connection Types
// ============================================

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
  get_utxos: (params?: {
    nanoErgs?: string;
    tokens?: Array<{ tokenId: string; amount?: string }>;
  }) => Promise<ErgoBox[] | undefined>;
  get_current_height: () => Promise<number>;
  sign_data: (address: string, data: Uint8Array) => Promise<Uint8Array>;
  sign_tx: (tx: UnsignedTransaction) => Promise<SignedTransaction>;
  submit_tx: (signedTx: SignedTransaction) => Promise<string>;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  balance: string | null; // nanoERG as string
  loading: boolean;
  error: string | null;
  isInstalled: boolean;
}

// ============================================
// Transaction Types (EIP-12 format)
// ============================================

export interface ErgoBoxAsset {
  tokenId: string;
  amount: string;
}

export interface ErgoBox {
  boxId: string;
  value: string;
  ergoTree: string;
  assets: ErgoBoxAsset[];
  additionalRegisters: Record<string, string>;
  creationHeight: number;
  transactionId: string;
  index: number;
  extension?: Record<string, unknown>;
}

export interface OutputBox {
  value: string;
  ergoTree: string;
  assets: ErgoBoxAsset[];
  additionalRegisters: Record<string, string>;
  creationHeight: number;
}

export interface UnsignedTransaction {
  inputs: Array<ErgoBox & { extension: Record<string, unknown> }>;
  outputs: OutputBox[];
  dataInputs: ErgoBox[];
  fee: number;
}

export interface SignedTransaction {
  id: string;
  inputs: unknown[];
  outputs: unknown[];
  [key: string]: unknown;
}

// ============================================
// Signing Types
// ============================================

export interface SignedMessage {
  message: string;
  signatureHex: string;
}

export interface SignedRaceEntry extends SignedMessage {
  address: string;
}

// ============================================
// Signature Verification (server-side)
// ============================================

export interface SignatureVerification {
  valid: boolean;
  address?: string;
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
