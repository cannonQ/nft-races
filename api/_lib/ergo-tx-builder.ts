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
 * Fetch unspent boxes for an address from Explorer API.
 * Returns enough boxes to cover `requiredNanoErgs`, sorted largest-first.
 */
export async function fetchUtxos(
  address: string,
  requiredNanoErgs: number,
): Promise<{ boxes: ExplorerBox[]; totalValue: number }> {
  const resp = await fetch(
    `${EXPLORER_API}/boxes/unspent/byAddress/${address}?limit=50&sortBy=value&sortDirection=desc`,
    { headers: { Accept: 'application/json' } },
  );

  if (!resp.ok) {
    throw new Error(`Explorer API error (${resp.status}): failed to fetch UTXOs`);
  }

  const data = await resp.json();
  const allBoxes: ExplorerBox[] = (data.items || data || []).map((b: any) => ({
    boxId: b.boxId,
    value: b.value,
    ergoTree: b.ergoTree,
    assets: (b.assets || []).map((a: any) => ({
      tokenId: a.tokenId,
      amount: a.amount,
    })),
  }));

  // Greedy selection: pick largest boxes until we cover the requirement
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
