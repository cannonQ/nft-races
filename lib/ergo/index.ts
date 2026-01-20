/**
 * Ergo Wallet Integration
 * Export all public types and utilities
 */

// Types
export type {
  RaceSignatureMessage,
  SignedRaceEntry,
  VerificationResult,
  TokenBalance,
  AddressBalance,
  NFTOwnershipResult,
  ExplorerBalanceResponse,
  WalletState,
  ErgoConnector,
  ErgoAPI,
  RaceEntry,
  Race,
  JoinRaceRequest,
  JoinRaceResponse,
} from './types';

// Client utilities (browser only)
export {
  isNautilusInstalled,
  connectNautilus,
  disconnectNautilus,
  isWalletConnected,
  getWalletAddress,
  getAllAddresses,
  getBalance,
  signRaceEntry,
  prepareRaceEntry,
  submitRaceEntry,
  getWalletState,
  createRaceMessage,
  messageToString,
  stringToBytes,
  bytesToHex,
  hexToBytes,
} from './client';

// Note: Server utilities should be imported directly from './server'
// to avoid bundling WASM on the client
// import { verifySignature, verifyNFTOwnership } from '@/lib/ergo/server';
