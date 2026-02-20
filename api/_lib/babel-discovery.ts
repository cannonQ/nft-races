/**
 * Server-side Babel box discovery for ErgoPay token fee flows.
 * Mirrors src/lib/ergo/babel.ts but runs in Node.js (Vercel serverless).
 */

const EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

/**
 * Babel fee contract body (EIP-0031), without header byte.
 * The ErgoTree can have two valid headers:
 *   0x10 (compact, no size prefix) or 0x18 + VLQ size (with size prefix).
 * Both are the same contract — we search for both to handle either creation method.
 */
const BABEL_ERGOTREE_BODY = '0604000e20{tokenId}0400040005000500d803d601e30004d602e4c6a70408d603e4c6a7050595e67201d804d604b2a5e4720100d605b2db63087204730000d606db6308a7d60799c1a7c17204d1968302019683050193c27204c2a7938c720501730193e4c672040408720293e4c672040505720393e4c67204060ec5a796830201929c998c7205029591b1720673028cb272067303000273047203720792720773057202';

const BABEL_HEADER_COMPACT = '10';
const BABEL_HEADER_WITH_SIZE = '18c101';

export interface ServerBabelBox {
  boxId: string;
  value: number;
  ergoTree: string;
  assets: Array<{ tokenId: string; amount: number }>;
  additionalRegisters: Record<string, string>;
  creationHeight: number;
  transactionId: string;
  index: number;
}

/** Build both possible Babel fee ErgoTrees for a given token ID. */
export function getBabelErgoTrees(tokenId: string): string[] {
  const body = BABEL_ERGOTREE_BODY.replace('{tokenId}', tokenId);
  return [
    `${BABEL_HEADER_COMPACT}${body}`,
    `${BABEL_HEADER_WITH_SIZE}${body}`,
  ];
}

/** Build a Babel fee contract ErgoTree (compact header) for a given token ID. */
export function getBabelErgoTree(tokenId: string): string {
  return getBabelErgoTrees(tokenId)[0];
}

/** Fetch unspent Babel boxes for a token from Explorer API.
 *  Tries both ErgoTree header formats (compact and with-size-prefix). */
export async function findBabelBoxes(tokenId: string): Promise<ServerBabelBox[]> {
  const ergoTrees = getBabelErgoTrees(tokenId);
  const allBoxes: ServerBabelBox[] = [];

  for (const ergoTree of ergoTrees) {
    try {
      const resp = await fetch(
        `${EXPLORER_API}/boxes/unspent/byErgoTree/${ergoTree}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const boxes = ((data.items || []) as any[])
        .map((b: any) => ({
          boxId: b.boxId,
          value: b.value,
          ergoTree: b.ergoTree,
          assets: (b.assets || []).map((a: any) => ({ tokenId: a.tokenId, amount: a.amount })),
          additionalRegisters: flattenRegisters(b.additionalRegisters),
          creationHeight: b.creationHeight,
          transactionId: b.transactionId,
          index: b.index,
        }));
      allBoxes.push(...boxes);
      if (allBoxes.length > 0) break; // found boxes, no need to try next format
    } catch {
      continue;
    }
  }

  return allBoxes.sort((a: ServerBabelBox, b: ServerBabelBox) => b.value - a.value);
}

/** Select a Babel box with enough ERG for miner fee + min box value. */
export function selectBabelBox(boxes: ServerBabelBox[], requiredNanoErg: number): ServerBabelBox | null {
  return boxes.find(b => b.value >= requiredNanoErg + 1_000_000) ?? null;
}

/**
 * Get the token price (nanoERG per token unit) from a Babel box's R5 register.
 * R5 is sigma-serialized as SLong. Format: 0x05 + zigzag-encoded value.
 */
export function getTokenPriceFromBox(box: ServerBabelBox): bigint {
  const r5 = box.additionalRegisters?.R5;
  if (!r5) throw new Error('Babel box missing R5 register (price)');

  // R5 is SLong: type byte 0x05 followed by zigzag-encoded VLQ value
  const bytes = hexToBytes(r5);
  if (bytes[0] !== 0x05) throw new Error(`Unexpected R5 type byte: 0x${bytes[0].toString(16)}`);

  // Decode zigzag VLQ starting at byte 1
  let value = 0n;
  let shift = 0n;
  for (let i = 1; i < bytes.length; i++) {
    const b = BigInt(bytes[i]);
    value |= (b & 0x7fn) << shift;
    if ((b & 0x80n) === 0n) break;
    shift += 7n;
  }
  // Zigzag decode: (value >>> 1) ^ -(value & 1)
  const decoded = (value >> 1n) ^ -(value & 1n);
  return decoded;
}

/**
 * Explorer API v1 returns registers as objects { serializedValue, sigmaType, renderedValue }.
 * Our code expects plain hex strings. Extract serializedValue when needed.
 */
function flattenRegisters(regs: Record<string, any> | undefined): Record<string, string> {
  if (!regs) return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(regs)) {
    out[key] = typeof val === 'object' && val !== null ? val.serializedValue : val;
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '');
  return new Uint8Array(clean.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
}

/**
 * Sigma-serialize SInt(value) as hex string.
 * Used for Babel box context extension: { "0": sigmaSerializeSInt(babelOutputIndex) }
 */
export function sigmaSerializeSInt(value: number): string {
  // SInt type = 0x04, then zigzag-encoded VLQ
  const zigzag = value >= 0 ? value * 2 : (-value) * 2 - 1;
  const parts: number[] = [0x04];
  let v = zigzag;
  while (v >= 128) {
    parts.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  parts.push(v);
  return parts.map(b => b.toString(16).padStart(2, '0')).join('');
}
