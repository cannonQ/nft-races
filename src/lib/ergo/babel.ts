/**
 * Babel box discovery for token fee payments (EIP-0031).
 *
 * Babel boxes allow users to pay miner fees in tokens instead of ERG.
 * The Babel box provides ERG for the miner fee and receives tokens in exchange.
 */

const EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

/** Minimum ERG a box must hold (protocol minimum) */
const MIN_BOX_VALUE = 1_000_000;

export interface BabelBox {
  boxId: string;
  value: number;       // nanoERG in the box
  ergoTree: string;
  assets: Array<{ tokenId: string; amount: number }>;
  additionalRegisters: Record<string, string>;
  creationHeight: number;
  transactionId: string;
  index: number;
}

/**
 * Babel fee contract body (EIP-0031).
 * The ErgoTree can have two valid headers:
 *   0x10 (compact, no size prefix) or 0x18 + VLQ size (with size prefix).
 * Both are the same contract — we search for both to handle either creation method.
 */
const BABEL_BODY_TEMPLATE =
  '0604000e20{tokenId}0400040005000500d803d601e30004d602e4c6a70408d603e4c6a7050595e67201d804d604b2a5e4720100d605b2db63087204730000d606db6308a7d60799c1a7c17204d1968302019683050193c27204c2a7938c720501730193e4c672040408720293e4c672040505720393e4c67204060ec5a796830201929c998c7205029591b1720673028cb272067303000273047203720792720773057202';

/** Header variants: compact (0x10) and with-size-prefix (0x18 + VLQ 193 = c101) */
const BABEL_HEADER_COMPACT = '10';
const BABEL_HEADER_WITH_SIZE = '18c101';

/**
 * Explorer API v1 returns registers as objects { serializedValue, sigmaType, renderedValue }.
 * Fleet SDK expects plain hex strings. Extract serializedValue when needed.
 */
function flattenRegisters(regs: Record<string, any> | undefined): Record<string, string> {
  if (!regs) return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(regs)) {
    out[key] = typeof val === 'object' && val !== null ? val.serializedValue : val;
  }
  return out;
}

/** Get both possible ErgoTrees for a Babel fee contract for a specific token. */
export function getBabelErgoTrees(tokenId: string): string[] {
  const body = BABEL_BODY_TEMPLATE.replace('{tokenId}', tokenId);
  return [
    `${BABEL_HEADER_COMPACT}${body}`,
    `${BABEL_HEADER_WITH_SIZE}${body}`,
  ];
}

/**
 * Find unspent Babel boxes for a given token on-chain.
 * Tries both ErgoTree header formats (compact and with-size-prefix).
 * Returns boxes sorted by ERG value descending (most liquidity first).
 */
export async function findBabelBoxes(tokenId: string): Promise<BabelBox[]> {
  const ergoTrees = getBabelErgoTrees(tokenId);
  const allBoxes: BabelBox[] = [];

  for (const ergoTree of ergoTrees) {
    try {
      const resp = await fetch(
        `${EXPLORER_API}/boxes/unspent/byErgoTree/${ergoTree}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const boxes = ((data.items || []) as any[])
        .map((b: any) => ({
          boxId: b.boxId,
          value: b.value,
          ergoTree: b.ergoTree, // Keep original ErgoTree — boxId is its hash
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

  return allBoxes.sort((a: BabelBox, b: BabelBox) => b.value - a.value);
}

/**
 * Select a Babel box with enough ERG to cover the miner fee.
 * Returns null if no suitable box is available.
 */
export function selectBabelBox(
  boxes: BabelBox[],
  requiredNanoErg: number,
): BabelBox | null {
  return boxes.find(b => b.value >= requiredNanoErg + MIN_BOX_VALUE) ?? null;
}
