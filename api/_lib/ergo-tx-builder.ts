/**
 * Server-side Ergo transaction builder for ErgoPay reduced TX flow.
 *
 * Ports sigma serialization from src/lib/ergo/transactions.ts
 * and adds UTXO fetching from Explorer API.
 */

const EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

export const TX_FEE = 1_100_000;
export const MIN_BOX_VALUE = 1_000_000;

// ── Sigma Serialization (ported from src/lib/ergo/transactions.ts) ───

/** Serialize a byte array as Sigma Coll[Byte]: 0x0e + VLQ(length) + raw bytes */
function sigmaSerializeCollByte(data: Uint8Array): string {
  const parts: number[] = [0x0e];
  let len = data.length;
  while (len >= 128) {
    parts.push((len & 0x7f) | 0x80);
    len >>>= 7;
  }
  parts.push(len);
  for (const b of data) parts.push(b);
  return Array.from(parts).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Serialize a UTF-8 string as Sigma Coll[Byte] */
function sigmaSerializeUtf8(text: string): string {
  return sigmaSerializeCollByte(new TextEncoder().encode(text));
}

/** Serialize a hex string (e.g. token ID) as Sigma Coll[Byte] */
function sigmaSerializeHex(hex: string): string {
  const clean = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(
    clean.match(/.{1,2}/g)!.map(b => parseInt(b, 16)),
  );
  return sigmaSerializeCollByte(bytes);
}

// ── Register Building ────────────────────────────────────────────────

export interface TxMetadata {
  actionType: string; // "train" or "race"
  tokenId: string;    // NFT token ID (hex, 64 chars)
  context: string;    // activity key or race identifier
}

/** Build additionalRegisters map from TX metadata (R4-R6). */
export function buildRegisters(metadata: TxMetadata): Record<string, string> {
  return {
    R4: sigmaSerializeUtf8(metadata.actionType),
    R5: sigmaSerializeHex(metadata.tokenId),
    R6: sigmaSerializeUtf8(metadata.context),
  };
}

// ── Explorer API: UTXO Fetching ──────────────────────────────────────

interface ExplorerBox {
  boxId: string;
  value: number;
  ergoTree: string;
  assets: Array<{ tokenId: string; amount: number }>;
}

/**
 * Fetch all unspent boxes for an address from Explorer API, sorted largest-first.
 */
async function fetchAllUtxos(address: string): Promise<ExplorerBox[]> {
  const resp = await fetch(
    `${EXPLORER_API}/boxes/unspent/byAddress/${address}?limit=50&sortBy=value&sortDirection=desc`,
    { headers: { Accept: 'application/json' } },
  );

  if (!resp.ok) {
    throw new Error(`Explorer API error (${resp.status}): failed to fetch UTXOs`);
  }

  const data = await resp.json();
  return (data.items || data || []).map((b: any) => ({
    boxId: b.boxId,
    value: b.value,
    ergoTree: b.ergoTree,
    assets: (b.assets || []).map((a: any) => ({
      tokenId: a.tokenId,
      amount: a.amount,
    })),
  }));
}

/**
 * Select boxes covering ERG and optionally token requirements.
 * When a token is required, boxes containing that token are prioritized.
 */
function selectBoxes(
  allBoxes: ExplorerBox[],
  requiredNanoErgs: number,
  requiredToken?: { tokenId: string; amount: bigint },
): { boxes: ExplorerBox[]; totalValue: number } {
  if (requiredToken) {
    // Split into boxes with/without the token, prioritize token boxes
    const withToken = allBoxes.filter(b =>
      b.assets.some(a => a.tokenId === requiredToken.tokenId),
    );
    const withoutToken = allBoxes.filter(b =>
      !b.assets.some(a => a.tokenId === requiredToken.tokenId),
    );

    const selected: ExplorerBox[] = [];
    let totalErg = 0;
    let totalTokens = 0n;

    // First pick boxes with the token
    for (const box of withToken) {
      selected.push(box);
      totalErg += box.value;
      totalTokens += BigInt(
        box.assets.find(a => a.tokenId === requiredToken.tokenId)?.amount ?? 0,
      );
      if (totalTokens >= requiredToken.amount && totalErg >= requiredNanoErgs) break;
    }

    // If still need more ERG, add non-token boxes
    if (totalErg < requiredNanoErgs) {
      for (const box of withoutToken) {
        selected.push(box);
        totalErg += box.value;
        if (totalErg >= requiredNanoErgs) break;
      }
    }

    if (totalTokens < requiredToken.amount) {
      throw new Error(
        `Insufficient tokens: need ${requiredToken.amount} raw units, wallet has ${totalTokens}`,
      );
    }
    if (totalErg < requiredNanoErgs) {
      throw new Error(
        `Insufficient funds: need ${(requiredNanoErgs / 1e9).toFixed(4)} ERG`,
      );
    }

    return { boxes: selected, totalValue: totalErg };
  }

  // ERG-only greedy selection
  const selected: ExplorerBox[] = [];
  let total = 0;
  for (const box of allBoxes) {
    selected.push(box);
    total += box.value;
    if (total >= requiredNanoErgs) break;
  }

  if (total < requiredNanoErgs) {
    const ergNeeded = (requiredNanoErgs / 1e9).toFixed(4);
    const ergHave = (total / 1e9).toFixed(4);
    throw new Error(
      `Insufficient funds: need ${ergNeeded} ERG, wallet has ${ergHave} ERG`,
    );
  }

  return { boxes: selected, totalValue: total };
}

/**
 * Fetch unspent boxes for an address from Explorer API.
 * Returns enough boxes to cover `requiredNanoErgs`, sorted largest-first.
 */
export async function fetchUtxos(
  address: string,
  requiredNanoErgs: number,
): Promise<{ boxes: ExplorerBox[]; totalValue: number }> {
  const allBoxes = await fetchAllUtxos(address);
  return selectBoxes(allBoxes, requiredNanoErgs);
}

// ── Block Height ─────────────────────────────────────────────────────

export async function getCurrentHeight(): Promise<number> {
  const resp = await fetch(
    `${EXPLORER_API}/blocks?limit=1&sortBy=height&sortDirection=desc`,
    { headers: { Accept: 'application/json' } },
  );
  if (!resp.ok) throw new Error('Failed to fetch current block height');
  const data = await resp.json();
  return data.items[0].height;
}

// ── Build Unsigned TX ────────────────────────────────────────────────

export interface BuildUnsignedTxParams {
  senderAddress: string;
  treasuryAddress: string;
  amountNanoErg: number;
  metadata: TxMetadata;
}

/**
 * Build the unsigned transaction object for POST /api/v1/reducedTx.
 *
 * The ergopay service fetches full box data from its node, rebuilds the TX,
 * reduces it, and stores it for the wallet to sign.
 *
 * We include only the treasury output (with R4-R6 registers).
 * The service uses `fee` and `changeAddress` to create fee + change outputs.
 */
export async function buildUnsignedTx(params: BuildUnsignedTxParams) {
  const { senderAddress, treasuryAddress, amountNanoErg, metadata } = params;

  // Total ERG needed: payment + miner fee + min box value for change
  const totalRequired = amountNanoErg + TX_FEE + MIN_BOX_VALUE;

  // Fetch UTXOs and block height in parallel
  const [{ boxes }, creationHeight] = await Promise.all([
    fetchUtxos(senderAddress, totalRequired),
    getCurrentHeight(),
  ]);

  // Build the treasury output with R4-R6 registers
  const registers = buildRegisters(metadata);

  return {
    creationHeight,
    fee: TX_FEE,
    changeAddress: senderAddress,
    inputs: boxes.map(b => ({ boxId: b.boxId })),
    dataInputs: [],
    outputs: [
      {
        value: amountNanoErg.toString(),
        address: treasuryAddress,
        assets: [],
        additionalRegisters: registers,
      },
    ],
  };
}

// ── Build Unsigned Batch TX (N outputs, 1 TX) ────────────────────────

export interface BuildUnsignedBatchTxParams {
  senderAddress: string;
  treasuryAddress: string;
  entries: Array<{ amountNanoErg: number; metadata: TxMetadata }>;
}

/**
 * Build an unsigned transaction with N treasury outputs (one per entry).
 * Used by ErgoPay batch flow — same structure as Nautilus batch but built server-side.
 */
export async function buildUnsignedBatchTx(params: BuildUnsignedBatchTxParams) {
  const { senderAddress, treasuryAddress, entries } = params;

  const totalAmount = entries.reduce((sum, e) => sum + e.amountNanoErg, 0);
  const totalRequired = totalAmount + TX_FEE + MIN_BOX_VALUE;

  const [{ boxes }, creationHeight] = await Promise.all([
    fetchUtxos(senderAddress, totalRequired),
    getCurrentHeight(),
  ]);

  const outputs = entries.map(entry => ({
    value: entry.amountNanoErg.toString(),
    address: treasuryAddress,
    assets: [],
    additionalRegisters: buildRegisters(entry.metadata),
  }));

  return {
    creationHeight,
    fee: TX_FEE,
    changeAddress: senderAddress,
    inputs: boxes.map(b => ({ boxId: b.boxId })),
    dataInputs: [],
    outputs,
  };
}

// ── Build Unsigned Token Fee TX (with Babel) ─────────────────────────

export interface BuildUnsignedTokenFeeTxParams {
  senderAddress: string;
  treasuryAddress: string;
  feeTokenId: string;
  feeTokenAmount: bigint;
  metadata: TxMetadata;
}

/**
 * Build an unsigned token fee TX for ErgoPay.
 * Includes a Babel box to cover the miner fee — sender pays only in tokens.
 * Treasury output receives MIN_BOX_VALUE ERG + fee tokens + R4-R6 registers.
 */
export async function buildUnsignedTokenFeeTx(params: BuildUnsignedTokenFeeTxParams) {
  const { senderAddress, treasuryAddress, feeTokenId, feeTokenAmount, metadata } = params;
  const {
    findBabelBoxes,
    selectBabelBox,
    getTokenPriceFromBox,
    sigmaSerializeSInt,
  } = await import('./babel-discovery.js');

  // Fetch all sender UTXOs, babel boxes, and block height in parallel
  const [allSenderBoxes, babelBoxes, creationHeight] = await Promise.all([
    fetchAllUtxos(senderAddress),
    findBabelBoxes(feeTokenId),
    getCurrentHeight(),
  ]);

  const babelBox = selectBabelBox(babelBoxes, TX_FEE + MIN_BOX_VALUE);
  if (!babelBox) {
    throw new Error('Token payment temporarily unavailable — Babel fee boxes depleted.');
  }

  // Calculate babel swap: how many tokens for the ERG the babel box provides
  const tokenPrice = getTokenPriceFromBox(babelBox);
  const ergFromBabel = BigInt(TX_FEE) + BigInt(MIN_BOX_VALUE); // miner fee + treasury min
  const babelSwapTokens = ergFromBabel / tokenPrice + 1n;

  // Select sender boxes with enough tokens (fee + babel swap) and ERG
  const totalTokensNeeded = feeTokenAmount + babelSwapTokens;
  const { boxes: senderBoxes } = selectBoxes(allSenderBoxes, MIN_BOX_VALUE, {
    tokenId: feeTokenId,
    amount: totalTokensNeeded,
  });

  // Build the treasury output (receives tokens + MIN_ERG)
  const registers = buildRegisters(metadata);
  const treasuryOutput = {
    value: MIN_BOX_VALUE.toString(),
    address: treasuryAddress,
    assets: [{ tokenId: feeTokenId, amount: feeTokenAmount.toString() }],
    additionalRegisters: registers,
  };

  // Build recreated Babel output (less ERG, more tokens)
  const babelChangeErg = babelBox.value - TX_FEE - MIN_BOX_VALUE;
  const existingBabelTokens = babelBox.assets.find(a => a.tokenId === feeTokenId)?.amount ?? 0;
  const babelOutput = {
    value: babelChangeErg.toString(),
    ergoTree: babelBox.ergoTree,
    assets: [{ tokenId: feeTokenId, amount: (BigInt(existingBabelTokens) + babelSwapTokens).toString() }],
    additionalRegisters: {
      ...babelBox.additionalRegisters,
      R6: sigmaCollByteFromHex(babelBox.boxId), // R6 = original box ID
    },
  };

  // Babel output is at index 1 (treasury=0, babel=1)
  const babelOutputIndex = 1;

  return {
    creationHeight,
    fee: TX_FEE,
    changeAddress: senderAddress,
    inputs: [
      ...senderBoxes.map(b => ({ boxId: b.boxId })),
      { boxId: babelBox.boxId, extension: { '0': sigmaSerializeSInt(babelOutputIndex) } },
    ],
    dataInputs: [],
    outputs: [treasuryOutput, babelOutput],
  };
}

/** Helper: Sigma-serialize a hex string as Coll[Byte] (for Babel R6 = boxId) */
function sigmaCollByteFromHex(hex: string): string {
  const clean = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(clean.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  const parts: number[] = [0x0e];
  let len = bytes.length;
  while (len >= 128) {
    parts.push((len & 0x7f) | 0x80);
    len >>>= 7;
  }
  parts.push(len);
  for (const b of bytes) parts.push(b);
  return parts.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Build Unsigned Batch Token Fee TX ────────────────────────────────

export interface BuildUnsignedBatchTokenFeeTxParams {
  senderAddress: string;
  treasuryAddress: string;
  feeTokenId: string;
  entries: Array<{ feeTokenAmount: bigint; metadata: TxMetadata }>;
}

/**
 * Build an unsigned batch token fee TX for ErgoPay.
 * N treasury outputs (one per entry), one Babel box covers the single miner fee.
 */
export async function buildUnsignedBatchTokenFeeTx(params: BuildUnsignedBatchTokenFeeTxParams) {
  const { senderAddress, treasuryAddress, feeTokenId, entries } = params;
  const {
    findBabelBoxes,
    selectBabelBox,
    getTokenPriceFromBox,
    sigmaSerializeSInt,
  } = await import('./babel-discovery.js');

  const totalFeeTokens = entries.reduce((sum, e) => sum + e.feeTokenAmount, 0n);

  const [allSenderBoxes, babelBoxes, creationHeight] = await Promise.all([
    fetchAllUtxos(senderAddress),
    findBabelBoxes(feeTokenId),
    getCurrentHeight(),
  ]);

  const babelBox = selectBabelBox(babelBoxes, TX_FEE + MIN_BOX_VALUE * entries.length);
  if (!babelBox) {
    throw new Error('Token payment temporarily unavailable — Babel fee boxes depleted.');
  }

  const tokenPrice = getTokenPriceFromBox(babelBox);
  const ergFromBabel = BigInt(TX_FEE) + BigInt(MIN_BOX_VALUE) * BigInt(entries.length);
  const babelSwapTokens = ergFromBabel / tokenPrice + 1n;

  // Select sender boxes with enough tokens and ERG
  const totalTokensNeeded = totalFeeTokens + babelSwapTokens;
  const { boxes: senderBoxes } = selectBoxes(allSenderBoxes, MIN_BOX_VALUE, {
    tokenId: feeTokenId,
    amount: totalTokensNeeded,
  });

  const registers = entries.map(e => buildRegisters(e.metadata));

  // N treasury outputs
  const treasuryOutputs = entries.map((entry, i) => ({
    value: MIN_BOX_VALUE.toString(),
    address: treasuryAddress,
    assets: [{ tokenId: feeTokenId, amount: entry.feeTokenAmount.toString() }],
    additionalRegisters: registers[i],
  }));

  // Babel recreated output (after all treasury outputs)
  const babelChangeErg = babelBox.value - TX_FEE - MIN_BOX_VALUE * entries.length;
  const existingBabelTokens = babelBox.assets.find(a => a.tokenId === feeTokenId)?.amount ?? 0;
  const babelOutput = {
    value: babelChangeErg.toString(),
    ergoTree: babelBox.ergoTree,
    assets: [{ tokenId: feeTokenId, amount: (BigInt(existingBabelTokens) + babelSwapTokens).toString() }],
    additionalRegisters: {
      ...babelBox.additionalRegisters,
      R6: sigmaCollByteFromHex(babelBox.boxId),
    },
  };

  const babelOutputIndex = entries.length; // after N treasury outputs

  return {
    creationHeight,
    fee: TX_FEE,
    changeAddress: senderAddress,
    inputs: [
      ...senderBoxes.map(b => ({ boxId: b.boxId })),
      { boxId: babelBox.boxId, extension: { '0': sigmaSerializeSInt(babelOutputIndex) } },
    ],
    dataInputs: [],
    outputs: [...treasuryOutputs, babelOutput],
  };
}
