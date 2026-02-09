/**
 * Ergo Transaction Building for CyberPets Racing
 *
 * Adapted from frontend-field-main/ergofunctions/walletUtils.js (make_pledge pattern)
 * and frontend-field-main/ergofunctions/helpers.js (signTx/signWalletTx)
 */

import type { ErgoBox, ErgoBoxAsset, OutputBox } from './types';

// ============================================
// Constants (from frontend-field-main/ergofunctions/consts.js)
// ============================================

export const TX_FEE = 1100000; // 1.1 ERG in nanoErgs
export const MIN_NERG_BOX_VALUE = 1000000; // 1 ERG minimum box value
export const CHANGE_BOX_VALUE = 7200000; // buffer for change box

// Standard miner fee ergoTree (from frontend-field-main)
const FEE_ERGO_TREE =
  '1005040004000e36100204a00b08cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ea02d192a39a8cc7a701730073011001020402d19683030193a38cc7b2a57300000193c2b2a57301007473027303830108cdeeac93b1a57304';

// ============================================
// Sign & Submit (from frontend-field-main/ergofunctions/helpers.js:230-250)
// ============================================

/**
 * Sign and submit a transaction via Nautilus.
 * Returns the transaction ID on success.
 */
export async function signAndSubmitTx(transactionToSign: unknown): Promise<string> {
  if (!window.ergo) {
    throw new Error('Wallet not connected');
  }

  const signedTx = await window.ergo.sign_tx(transactionToSign as any);
  const txId = await window.ergo.submit_tx(signedTx);

  if (!txId || txId.length === 0) {
    throw new Error('Transaction submission failed — no txId returned');
  }

  return txId;
}

// ============================================
// UTXO Selection (from frontend-field-main/ergofunctions/walletUtils.js:394-479)
// ============================================

/**
 * Get UTXOs from the connected wallet that cover the required nanoErgs amount.
 * Returns the input boxes and the total excess ERG (for change calculation).
 */
async function getWalletUtxos(
  requiredNanoErgs: number
): Promise<{ inputs: ErgoBox[]; totalInputValue: number }> {
  if (!window.ergo) throw new Error('Wallet not connected');

  const utxos = await window.ergo.get_utxos({
    nanoErgs: requiredNanoErgs.toString(),
  });

  if (!utxos || utxos.length === 0) {
    throw new Error('Not enough balance in wallet');
  }

  const totalInputValue = utxos.reduce(
    (sum, box) => sum + parseInt(box.value, 10),
    0
  );

  if (totalInputValue < requiredNanoErgs) {
    throw new Error(
      `Insufficient funds. Need ${requiredNanoErgs} nanoERG, have ${totalInputValue}`
    );
  }

  return { inputs: utxos, totalInputValue };
}

// ============================================
// Asset Filtering (from frontend-field-main/ergofunctions/walletUtils.js)
// ============================================

/**
 * Collect all non-zero token assets from inputs (for change box).
 */
function collectChangeAssets(inputs: ErgoBox[]): ErgoBoxAsset[] {
  const tokenMap = new Map<string, bigint>();

  for (const box of inputs) {
    for (const asset of box.assets) {
      const current = tokenMap.get(asset.tokenId) ?? 0n;
      tokenMap.set(asset.tokenId, current + BigInt(asset.amount));
    }
  }

  const result: ErgoBoxAsset[] = [];
  for (const [tokenId, amount] of tokenMap) {
    if (amount > 0n) {
      result.push({ tokenId, amount: amount.toString() });
    }
  }
  return result;
}

// ============================================
// Get Current Block Height
// ============================================

async function getCurrentHeight(): Promise<number> {
  // Try wallet API first
  if (window.ergo) {
    try {
      return await window.ergo.get_current_height();
    } catch {
      // Fall through to explorer API
    }
  }

  // Fall back to Ergo explorer
  const response = await fetch(
    'https://api.ergoplatform.com/api/v1/blocks?limit=1&sortBy=height&sortDirection=desc'
  );
  if (!response.ok) throw new Error('Failed to fetch block height');
  const data = await response.json();
  return data.items[0].height;
}

// ============================================
// Address → ergoTree conversion
// ============================================

/**
 * Convert an Ergo address to its ergoTree representation.
 * Uses the Ergo explorer API as a simple way to do this without WASM.
 */
async function addressToErgoTree(address: string): Promise<string> {
  const response = await fetch(
    `https://api.ergoplatform.com/api/v1/addresses/${address}`
  );
  if (!response.ok) throw new Error(`Failed to resolve address: ${address}`);
  const data = await response.json();
  // The explorer returns { ergoTree: "...", ... } but the actual endpoint
  // for address info is different. Let's use a simpler approach:
  // P2PK addresses have a predictable ergoTree format.
  // For robustness, we'll use the /api/v1/boxes/byAddress endpoint.
  // Actually, let's use the direct approach: fetch the ergoTree for a known box.
  // Simpler: use the Ergo node API's /utils/addressToRaw endpoint
  // For now, use the wallet's change address ergoTree from UTXOs.
  throw new Error('Use getErgoTreeFromUtxo instead');
}

/**
 * Get the user's ergoTree from one of their UTXOs.
 */
function getErgoTreeFromInputs(inputs: ErgoBox[], userAddress: string): string {
  // In EIP-12 boxes from the wallet, the ergoTree is already present
  if (inputs.length > 0) {
    return inputs[0].ergoTree;
  }
  throw new Error('No inputs available to derive ergoTree');
}

// ============================================
// Build Entry Fee Transaction
// ============================================

/**
 * Build, sign, and submit an entry fee payment transaction.
 *
 * Follows the proven pattern from frontend-field-main:
 * 1. Get UTXOs from wallet
 * 2. Build treasury output box (entry fee)
 * 3. Build change box (remaining ERG + tokens back to user)
 * 4. Build miner fee box
 * 5. Assemble unsigned transaction
 * 6. Sign and submit via Nautilus
 *
 * @param entryFeeNanoErgs - Entry fee amount in nanoERG
 * @param treasuryErgoTree - The ergoTree of the treasury/contract address
 * @returns Transaction ID
 */
export async function buildAndSubmitEntryFeeTx(
  entryFeeNanoErgs: number,
  treasuryErgoTree: string
): Promise<string> {
  if (!window.ergo) throw new Error('Wallet not connected');

  // 1. Calculate total required ERG
  const totalRequired = entryFeeNanoErgs + TX_FEE + CHANGE_BOX_VALUE;

  // 2. Get UTXOs from wallet
  const { inputs, totalInputValue } = await getWalletUtxos(totalRequired);

  // 3. Get current block height
  const blockHeight = await getCurrentHeight();

  // 4. Calculate change
  const changeValue = totalInputValue - entryFeeNanoErgs - TX_FEE;
  if (changeValue < MIN_NERG_BOX_VALUE) {
    throw new Error('Insufficient funds after fees');
  }

  // 5. Get user's ergoTree for change box
  const userErgoTree = getErgoTreeFromInputs(inputs, '');

  // 6. Collect any tokens from inputs (return them in change)
  const changeAssets = collectChangeAssets(inputs);

  // 7. Build output boxes

  // Treasury box (receives the entry fee)
  const treasuryBox: OutputBox = {
    value: entryFeeNanoErgs.toString(),
    ergoTree: treasuryErgoTree,
    assets: [],
    additionalRegisters: {},
    creationHeight: blockHeight,
  };

  // Change box (remaining ERG + tokens back to user)
  const changeBox: OutputBox = {
    value: changeValue.toString(),
    ergoTree: userErgoTree,
    assets: changeAssets,
    additionalRegisters: {},
    creationHeight: blockHeight,
  };

  // Miner fee box (standard pattern from frontend-field-main)
  const feeBox: OutputBox = {
    value: TX_FEE.toString(),
    ergoTree: FEE_ERGO_TREE,
    assets: [],
    additionalRegisters: {},
    creationHeight: blockHeight,
  };

  // 8. Prepare inputs with extension field (required by EIP-12)
  const inputList = inputs.map((box) => ({
    ...box,
    extension: {},
  }));

  // 9. Remove duplicate inputs (safety check from frontend-field-main)
  const uniqueInputs = inputList.filter(
    (box, index, self) =>
      index === self.findIndex((b) => b.boxId === box.boxId)
  );

  // 10. Assemble unsigned transaction
  const unsignedTx = {
    inputs: uniqueInputs,
    outputs: [treasuryBox, changeBox, feeBox],
    dataInputs: [],
    fee: TX_FEE,
  };

  // 11. Sign and submit
  return await signAndSubmitTx(unsignedTx);
}
