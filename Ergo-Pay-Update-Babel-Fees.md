# Babel Box Token Payments — Technical Reference

Comprehensive guide to paying game fees in tokens (e.g. CYPX) instead of ERG, using Babel boxes (EIP-0031). Covers both Nautilus (browser extension) and ErgoPay (mobile wallet) flows.

**Status**: Fully implemented and live. Both flows confirmed working on mainnet.

---

## Table of Contents

1. [EIP-0031 Babel Box Primer](#1-eip-0031-babel-box-primer)
2. [Babel Box Discovery](#2-babel-box-discovery)
3. [Fee Config Architecture](#3-fee-config-architecture)
4. [Nautilus Flow (Client-Side)](#4-nautilus-flow-client-side)
5. [ErgoPay Flow (Server-Side)](#5-ergopay-flow-server-side)
6. [TX Verification](#6-tx-verification)
7. [Common Pitfalls](#7-common-pitfalls)
8. [Key Files Reference](#8-key-files-reference)

---

## 1. EIP-0031 Babel Box Primer

### What is a Babel Box?

A Babel box is an on-chain UTXO that enables users to pay miner fees in tokens instead of ERG. It works like a DEX limit order:

- A liquidity provider creates a box locked by the **Babel fee contract**
- The box holds ERG and offers to exchange it for a specific token at a set price
- When a user builds a TX, they spend the Babel box as an input and recreate it as an output with less ERG and more tokens
- The ERG extracted from the Babel box covers the miner fee + any MIN_BOX_VALUE requirements
- The user pays only in tokens — zero ERG required in their wallet

### The Babel Fee Contract

The contract body (without header byte) is a fixed template parameterized by token ID:

```
0604000e20{tokenId}0400040005000500d803d601e30004d602e4c6a70408d603e4c6a7050595e67201d804d604b2a5e4720100d605b2db63087204730000d606db6308a7d60799c1a7c17204d1968302019683050193c27204c2a7938c720501730193e4c672040408720293e4c672040505720393e4c67204060ec5a796830201929c998c7205029591b1720673028cb272067303000273047203720792720773057202
```

### ErgoTree Header Variants

The full ErgoTree = header + body. Two valid header formats exist:

| Header | Hex | Description |
|--------|-----|-------------|
| Compact | `10` | No size prefix. Fleet SDK default. ErgoTree length = 194 bytes (388 hex chars). |
| With-size | `18c101` | Has VLQ-encoded size prefix. Created by `ergo-lib-wasm` / Ergo node. |

**Both encode the exact same contract.** However, Explorer API does exact string matching on ErgoTree, so you must search for both formats when discovering Babel boxes.

### Contract Registers

| Register | Type | Content |
|----------|------|---------|
| R4 | `SGroupElement` (0x08cd...) | Public key of the Babel box creator (for identification) |
| R5 | `SLong` (0x05...) | Token price in nanoERG per raw token unit |
| R6 | `Coll[Byte]` (0x0e20...) | Original box ID (self-reference for recreation) |

### Context Extension

When spending a Babel box, you must provide a **context extension** telling the contract which output index recreates it:

```json
{ "0": "0402" }
```

- Key `"0"` = variable index 0 in the contract
- Value `"0402"` = Sigma-serialized `SInt(1)` (output index 1)
- `04` = SInt type tag, `02` = zigzag-encoded value 1

### How the Swap Math Works

```
tokenPrice = R5 value (nanoERG per raw token unit)
ergNeeded = TX_FEE (1,100,000) + MIN_BOX_VALUE (1,000,000) per treasury output
babelSwapTokens = ergNeeded / tokenPrice + 1   // +1 for rounding safety

// Recreated Babel output:
babelOutput.value = babelBox.value - ergNeeded
babelOutput.tokens = babelBox.tokens + babelSwapTokens
```

The `+1n` rounding prevents underpaying when `ergNeeded` doesn't divide evenly by `tokenPrice`.

---

## 2. Babel Box Discovery

### Finding Boxes On-Chain

Query the Explorer API for unspent boxes by ErgoTree. Must try both header formats:

```typescript
// api/_lib/babel-discovery.ts  OR  src/lib/ergo/babel.ts

function getBabelErgoTrees(tokenId: string): string[] {
  const body = BABEL_BODY_TEMPLATE.replace('{tokenId}', tokenId);
  return [
    `10${body}`,       // compact header
    `18c101${body}`,   // with-size header
  ];
}

async function findBabelBoxes(tokenId: string): Promise<BabelBox[]> {
  for (const ergoTree of getBabelErgoTrees(tokenId)) {
    const resp = await fetch(
      `https://api.ergoplatform.com/api/v1/boxes/unspent/byErgoTree/${ergoTree}`
    );
    // ... parse and return boxes
    if (boxes.length > 0) break; // found boxes, skip other format
  }
  return allBoxes.sort((a, b) => b.value - a.value); // most liquidity first
}
```

### Explorer Register Format Gotcha

Explorer API v1 returns registers as objects, not plain hex strings:

```json
{
  "R4": { "serializedValue": "08cd...", "sigmaType": "SGroupElement", "renderedValue": "..." },
  "R5": { "serializedValue": "05fcfe20", "sigmaType": "SLong", "renderedValue": "..." }
}
```

You need a `flattenRegisters()` helper to extract `serializedValue`:

```typescript
function flattenRegisters(regs: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(regs)) {
    out[key] = typeof val === 'object' && val !== null ? val.serializedValue : val;
  }
  return out;
}
```

### Selecting a Babel Box

Pick the first box with enough ERG to cover the miner fee plus one MIN_BOX_VALUE per treasury output:

```typescript
function selectBabelBox(boxes: BabelBox[], requiredNanoErg: number): BabelBox | null {
  return boxes.find(b => b.value >= requiredNanoErg + MIN_BOX_VALUE) ?? null;
}

// Single output: selectBabelBox(boxes, TX_FEE + MIN_BOX_VALUE)
// Batch (N outputs): selectBabelBox(boxes, TX_FEE + MIN_BOX_VALUE * N)
```

### Reading the Token Price from R5

R5 is Sigma-serialized `SLong` — type byte `0x05` followed by zigzag-encoded VLQ:

```typescript
function getTokenPriceFromBox(box: BabelBox): bigint {
  const bytes = hexToBytes(box.additionalRegisters.R5);
  // bytes[0] = 0x05 (SLong type tag)
  // Decode zigzag VLQ starting at byte 1
  let value = 0n, shift = 0n;
  for (let i = 1; i < bytes.length; i++) {
    value |= (BigInt(bytes[i]) & 0x7fn) << shift;
    if ((bytes[i] & 0x80) === 0) break;
    shift += 7n;
  }
  return (value >> 1n) ^ -(value & 1n); // zigzag decode
}
```

In Fleet SDK (client-side), you can use:
```typescript
const tokenPrice = SConstant.from<bigint>(babelBox.additionalRegisters.R5).data;
```

---

## 3. Fee Config Architecture

### Per-Collection Config

Fee amounts are stored in `collections.game_config_overrides` (Supabase), resolved via `getGameConfig(collectionId)` in `api/_lib/config.ts`. Example config:

```json
{
  "fee_token": {
    "token_id": "01dce8a5632d19799950ff90bca3b5d0ca3ebfa8aaafd06f0cc6dd1e97150e7f",
    "name": "CYPX",
    "decimals": 4,
    "training_fee": 37,
    "default_race_entry_fee": 187,
    "treatment_fees": {
      "stim_pack": 19,
      "cryo_pod": 37,
      "full_reset": 94
    }
  }
}
```

### Decimal Scaling

Config stores **human-readable** amounts (e.g. `37` CYPX). Raw token units on-chain use `amount * 10^decimals`:

```
37 CYPX (4 decimals) → 370,000 raw token units
187 CYPX → 1,870,000 raw token units
```

**You must scale in ALL locations** where token amounts are used:

| Location | Code |
|----------|------|
| Nautilus TX builder (client) | `BigInt(amount) * BigInt(10 ** decimals)` |
| ErgoPay TX builder (server) | Same formula |
| ErgoPay batch TX builder | Same formula |
| TX verification (server) | `verifyTokenTxOnChain(..., expectedTokenAmount)` |
| Credit ledger recording | Store both human-readable + raw |
| Frontend display | Show human-readable amount |

### Dual Currency Support

The system supports both ERG and token payments. The `paymentCurrency` field (`'erg'` or `'token'`) controls which path:

```typescript
// Frontend sends: { paymentCurrency: 'token', ... }
// Backend checks:
if (paymentCurrency === 'token') {
  const feeTokenConfig = mergedConfig?.fee_token;
  // ... build token TX
} else {
  // ... build ERG TX (original path)
}
```

---

## 4. Nautilus Flow (Client-Side)

**File**: `src/lib/ergo/transactions.ts`

### Overview

Nautilus (browser extension wallet) provides the EIP-12 dApp connector API. The client builds the full unsigned TX locally, then Nautilus signs and submits it.

### UTXO Selection

Nautilus wallet API supports token-aware UTXO selection natively:

```typescript
// ERG-only selection:
const utxos = await window.ergo.get_utxos({ nanoErgs: requiredAmount.toString() });

// Token-aware selection (for Babel TXs):
const utxos = await window.ergo.get_utxos({
  tokens: [{ tokenId: feeToken.tokenId, amount: totalTokensNeeded.toString() }],
});
```

### Building the Babel TX with Fleet SDK

We use Fleet SDK's `TransactionBuilder` but bypass `BabelSwapPlugin` because it validates ErgoTree format (requires compact `0x10` header + exact length 388). On-chain Babel boxes created with `ergo-lib-wasm` have the `0x18c101` header and fail that validation.

**Solution**: Manual Babel swap using `ErgoUnsignedInput` + `OutputBuilder.from()`:

```typescript
import { TransactionBuilder, OutputBuilder, SAFE_MIN_BOX_VALUE, ErgoUnsignedInput } from '@fleet-sdk/core';
import { SConstant, SColl, SByte, SInt } from '@fleet-sdk/serializer';

// 1. Read price from R5 (works regardless of ErgoTree header format)
const tokenPrice = SConstant.from<bigint>(babelBox.additionalRegisters.R5).data;
const ergNeeded = BigInt(TX_FEE) + SAFE_MIN_BOX_VALUE;
const babelSwapTokens = ergNeeded / tokenPrice + 1n;

// 2. Build treasury output (receives tokens + MIN_ERG)
const treasuryOutput = new OutputBuilder(SAFE_MIN_BOX_VALUE, treasuryErgoTree)
  .addTokens({ tokenId: feeToken.tokenId, amount: feeToken.amount })
  .setAdditionalRegisters(registers);

// 3. Build Babel swap as a TransactionBuilder extension
const babelSwap = ({ addInputs, addOutputs }) => {
  const input = new ErgoUnsignedInput(babelBox);
  const changeAmount = BigInt(babelBox.value) - babelSwapTokens * tokenPrice;

  // OutputBuilder.from() preserves original ErgoTree bytes — critical!
  const outputsLength = addOutputs(
    OutputBuilder.from(input)
      .setValue(changeAmount)
      .addTokens({ tokenId: feeToken.tokenId, amount: babelSwapTokens })
      .setAdditionalRegisters({ R6: SColl(SByte, input.boxId) }),
  );

  // Context extension: variable 0 = output index of recreated Babel box
  addInputs(input.setContextExtension({ 0: SInt(outputsLength - 1) }));
};

// 4. Build and sign
const unsignedTx = new TransactionBuilder(blockHeight)
  .from(utxos)
  .to(treasuryOutput)
  .extend(babelSwap)           // Babel box added via extension
  .payMinFee()
  .sendChangeTo(changeAddress)
  .build()
  .toEIP12Object();

const txId = await signAndSubmitTx(unsignedTx);
```

### Key Points — Nautilus

- `OutputBuilder.from(input)` preserves the original ErgoTree bytes from the Babel box. This is essential — see Pitfall #1.
- `SInt(outputsLength - 1)` computes the correct output index dynamically (after TransactionBuilder adds change/fee outputs).
- `SColl(SByte, input.boxId)` writes the original box ID into R6 of the recreated output.
- Wallet handles change output and miner fee output automatically.
- The user sees the full TX in Nautilus for approval before signing.

---

## 5. ErgoPay Flow (Server-Side)

**Files**: `api/_lib/ergo-tx-builder.ts`, `api/v2/ergopay/tx/request.ts`

### Overview

ErgoPay (mobile wallet) cannot build TXs locally. Instead:

1. **Our server** fetches UTXOs from Explorer API, builds the unsigned TX
2. Server POSTs the unsigned TX to the **ErgoPay relay** (`ergopay.duckdns.org/api/v1/reducedTx`)
3. The relay fetches full box data from its Ergo node, reduces the TX, stores it
4. The relay returns an `ergopay://` URL
5. The **mobile wallet** opens the URL, signs, and submits the TX
6. The wallet POSTs the signed TX ID back to our **callback URL**

### Token-Aware UTXO Selection

The server must fetch UTXOs from Explorer and select boxes that contain the required token. This is a two-step process (unlike Nautilus which has native token-aware selection):

```typescript
// api/_lib/ergo-tx-builder.ts

// Step 1: Fetch ALL unspent boxes for the sender
async function fetchAllUtxos(address: string): Promise<ExplorerBox[]> {
  const resp = await fetch(
    `${EXPLORER_API}/boxes/unspent/byAddress/${address}?limit=50&sortBy=value&sortDirection=desc`
  );
  return (data.items || data || []).map(b => ({
    boxId: b.boxId, value: b.value, ergoTree: b.ergoTree,
    assets: (b.assets || []).map(a => ({ tokenId: a.tokenId, amount: a.amount })),
  }));
}

// Step 2: Select boxes prioritizing those with the required token
function selectBoxes(
  allBoxes: ExplorerBox[],
  requiredNanoErgs: number,
  requiredToken?: { tokenId: string; amount: bigint },
): { boxes: ExplorerBox[]; totalValue: number } {
  if (requiredToken) {
    const withToken = allBoxes.filter(b =>
      b.assets.some(a => a.tokenId === requiredToken.tokenId));
    const withoutToken = allBoxes.filter(b =>
      !b.assets.some(a => a.tokenId === requiredToken.tokenId));

    const selected: ExplorerBox[] = [];
    let totalErg = 0, totalTokens = 0n;

    // First: pick boxes containing the token
    for (const box of withToken) {
      selected.push(box);
      totalErg += box.value;
      totalTokens += BigInt(
        box.assets.find(a => a.tokenId === requiredToken.tokenId)?.amount ?? 0);
      if (totalTokens >= requiredToken.amount && totalErg >= requiredNanoErgs) break;
    }

    // Then: add ERG-only boxes if still need more ERG
    if (totalErg < requiredNanoErgs) {
      for (const box of withoutToken) {
        selected.push(box);
        totalErg += box.value;
        if (totalErg >= requiredNanoErgs) break;
      }
    }

    if (totalTokens < requiredToken.amount)
      throw new Error(`Insufficient tokens: need ${requiredToken.amount} raw units, wallet has ${totalTokens}`);
    if (totalErg < requiredNanoErgs)
      throw new Error(`Insufficient funds: need ${(requiredNanoErgs / 1e9).toFixed(4)} ERG`);

    return { boxes: selected, totalValue: totalErg };
  }
  // ... ERG-only fallback (greedy selection)
}
```

### Building the Unsigned Token Fee TX

```typescript
// api/_lib/ergo-tx-builder.ts — buildUnsignedTokenFeeTx()

// 1. Fetch sender UTXOs, Babel boxes, and block height in parallel
const [allSenderBoxes, babelBoxes, creationHeight] = await Promise.all([
  fetchAllUtxos(senderAddress),
  findBabelBoxes(feeTokenId),
  getCurrentHeight(),
]);

// 2. Select Babel box + calculate swap
const babelBox = selectBabelBox(babelBoxes, TX_FEE + MIN_BOX_VALUE);
const tokenPrice = getTokenPriceFromBox(babelBox);
const ergFromBabel = BigInt(TX_FEE) + BigInt(MIN_BOX_VALUE);
const babelSwapTokens = ergFromBabel / tokenPrice + 1n;

// 3. Select sender boxes with enough tokens
const totalTokensNeeded = feeTokenAmount + babelSwapTokens;
const { boxes: senderBoxes } = selectBoxes(allSenderBoxes, MIN_BOX_VALUE, {
  tokenId: feeTokenId,
  amount: totalTokensNeeded,
});

// 4. Build treasury output (tokens + MIN_ERG + R4-R6 metadata)
const treasuryOutput = {
  value: MIN_BOX_VALUE.toString(),
  address: treasuryAddress,
  assets: [{ tokenId: feeTokenId, amount: feeTokenAmount.toString() }],
  additionalRegisters: buildRegisters(metadata),
};

// 5. Build recreated Babel output
const babelOutput = {
  value: (babelBox.value - TX_FEE - MIN_BOX_VALUE).toString(),
  ergoTree: babelBox.ergoTree,    // MUST use original ErgoTree bytes!
  assets: [{ tokenId: feeTokenId,
    amount: (BigInt(existingBabelTokens) + babelSwapTokens).toString() }],
  additionalRegisters: {
    ...babelBox.additionalRegisters,
    R6: sigmaCollByteFromHex(babelBox.boxId), // Self-reference
  },
};

// 6. Assemble — Babel input is LAST, with context extension
return {
  creationHeight,
  fee: TX_FEE,
  changeAddress: senderAddress,
  inputs: [
    ...senderBoxes.map(b => ({ boxId: b.boxId })),
    { boxId: babelBox.boxId, extension: { '0': sigmaSerializeSInt(1) } },
  ],
  dataInputs: [],
  outputs: [treasuryOutput, babelOutput],
};
```

### ErgoPay Relay Payload Format

The unsigned TX is wrapped in the ErgoPay relay's expected format:

```json
{
  "address": "9senderAddress...",
  "message": "CyberPets Racing: Training Fee (37 CYPX)",
  "messageSeverity": "INFORMATION",
  "replyTo": "https://nft-races.vercel.app/api/v2/ergopay/tx/callback/REQUEST_ID",
  "unsignedTx": {
    "creationHeight": 1724997,
    "fee": 1100000,
    "changeAddress": "9senderAddress...",
    "inputs": [
      { "boxId": "aabb..." },
      { "boxId": "ccdd...", "extension": { "0": "0402" } }
    ],
    "dataInputs": [],
    "outputs": [
      {
        "value": "1000000",
        "address": "9treasury...",
        "assets": [{ "tokenId": "01dce8a5...", "amount": "370000" }],
        "additionalRegisters": { "R4": "0e05...", "R5": "0e20...", "R6": "0e08..." }
      },
      {
        "value": "234927040",
        "ergoTree": "18c1010604000e20...",
        "assets": [{ "tokenId": "01dce8a5...", "amount": "56" }],
        "additionalRegisters": { "R4": "08cd...", "R5": "05fcfe20", "R6": "0e20..." }
      }
    ]
  }
}
```

**Key differences from simple ERG TX:**

| Field | ERG TX | Babel Token TX |
|-------|--------|----------------|
| `inputs[].extension` | Not present | `{ "0": "0402" }` on Babel input |
| `outputs[].ergoTree` | Not present (uses `address`) | Present on Babel output |
| `outputs[].assets` | Empty `[]` | Tokens on treasury + Babel outputs |
| Output count | 1 (treasury only) | 2 (treasury + recreated Babel box) |

### Relay Requirements

The ErgoPay relay (`ergopay.duckdns.org`) must support:

1. **Input context extensions** — Parse `input.extension`, attach as `ContextExtension` on each `UnsignedInput`
2. **ErgoTree-based outputs** — If `output.ergoTree` is present, use it directly instead of deriving from `output.address`
3. **Exact box-ID input selection** — Fetch inputs by their specific `boxId` using `ctx.getBoxesById()`, NOT address-based selection (see Pitfall 8 below)

### Relay Troubleshooting

The relay is a Spring Boot app maintained separately (contact: @Arohbe). When Babel TXs fail at the relay level:

1. **Get the Java stack trace** from the relay server logs (Spring Boot console output)
2. **Check our server logs** — `request.ts` now logs the full relay error body + the payload that failed
3. **Check the browser console** — `ergopay-tx.ts` logs `[ErgoPay] Relay rejection:` with status and body
4. **Common relay errors**:
   - `AssertionError: unexpected selected boxes` → Relay's `DefaultBoxSelector` dropped the Babel input (see Pitfall 8)
   - `NotEnoughTokensError` → Relay doing address-based UTXO selection, not finding Babel box tokens
   - Generic 500 with no detail → Check relay node sync status (`/info` endpoint, compare `fullHeight` to network)

### Relay Architecture Notes

The relay uses the Ergo Appkit SDK (Java/Scala). Key classes:

- `BoxOperations.createForSender(address, ctx)` — **Address-based** box loading. Only finds boxes owned by the sender. **Cannot find Babel boxes** (they're owned by the Babel contract).
- `ctx.getBoxesById(boxId1, boxId2)` — **Box-ID-based** lookup. Finds any box regardless of owner. **Required for Babel TXs.**
- `UnsignedTransactionBuilder.build()` — Internally runs `DefaultBoxSelector` which can drop inputs. See Pitfall 8.
- `ReducedTransaction` / `prover.reduce()` — Converts unsigned TX to reduced form for wallet signing.

---

## 6. TX Verification

**File**: `api/_lib/verify-tx.ts`

### ERG Payment Verification

For ERG payments, verify that TX outputs to the treasury address sum to at least the expected nanoERG amount:

```typescript
async function verifyTxOnChain(txId, treasuryAddress, expectedAmountNanoerg)
  → { valid: boolean; reason?: string }
```

### Token Payment Verification

For token payments, verify that TX outputs to the treasury contain at least the expected token amount:

```typescript
async function verifyTokenTxOnChain(txId, treasuryAddress, expectedTokenId, expectedTokenAmount)
  → { valid: boolean; reason?: string }
```

### Soft-Fail Pattern

Both functions **soft-fail** (return `valid: true`) when:
- Explorer API is unreachable
- TX is not yet confirmed (404 — may be in mempool)

The hard protection against replay is `isTxIdUsed()` — dedup check against the `credit_ledger` table.

### Dedup

Every TX ID is recorded in `credit_ledger.tx_id`. Before accepting a payment:

```typescript
const used = await isTxIdUsed(txId);
if (used) return res.status(409).json({ error: 'Transaction already used' });
```

---

## 7. Common Pitfalls

### Pitfall 1: ErgoTree Bytes Must Be Preserved Exactly

**Symptom**: "Script reduced to false" error when wallet tries to sign.

**Cause**: The Babel contract checks `selfOutput.propositionBytes == SELF.propositionBytes`. If you change the ErgoTree header (e.g. convert `18c101...` to `10...` compact format), the byte sequences no longer match and the script fails.

**Fix**: Always use `babelBox.ergoTree` directly from the on-chain box. Never normalize, compact, or re-encode the ErgoTree.

```typescript
// WRONG — changes propositionBytes:
const compactTree = toCompactErgoTree(babelBox.ergoTree);

// CORRECT — preserves original bytes:
babelOutput.ergoTree = babelBox.ergoTree;

// Fleet SDK equivalent (correct):
OutputBuilder.from(input)  // preserves ergoTree from input
```

### Pitfall 2: Fleet SDK BabelSwapPlugin Validation

**Symptom**: Fleet SDK throws "invalid babel contract" for valid on-chain boxes.

**Cause**: Fleet SDK's `isValidBabelContract()` requires the compact `0x10` header + exact ErgoTree length of 388 hex chars. Boxes created with `ergo-lib-wasm` or the Ergo node use the `0x18c101` header, which fails validation.

**Fix**: Bypass `BabelSwapPlugin` entirely. Use manual Babel swap via `ErgoUnsignedInput` + `OutputBuilder.from()` + `setContextExtension()`. See Section 4.

### Pitfall 3: Server-Side UTXO Selection Must Be Token-Aware

**Symptom**: ErgoPay relay returns `NotEnoughTokensError` — inputs have 0 (or few) tokens.

**Cause**: Original `fetchUtxos()` selected boxes by ERG value only. For Babel TXs, the sender must provide boxes containing the required token amount.

**Fix**: Two-step selection — fetch all UTXOs, then prioritize boxes containing the token. See `selectBoxes()` in Section 5.

### Pitfall 4: Explorer API Register Format

**Symptom**: SConstant parsing fails, or registers contain `[object Object]`.

**Cause**: Explorer API v1 returns registers as `{ serializedValue, sigmaType, renderedValue }` objects, not plain hex strings.

**Fix**: Use `flattenRegisters()` to extract `serializedValue`. See Section 2.

### Pitfall 5: Decimal Scaling in All Locations

**Symptom**: Paying 37 raw units instead of 370,000 (or vice versa).

**Cause**: Config stores human-readable amounts (`37` CYPX) but the blockchain works in raw units (`370,000` for 4-decimal token).

**Fix**: Apply `BigInt(amount) * BigInt(10 ** decimals)` consistently in all 10 locations:

1. Nautilus single TX builder (`src/lib/ergo/transactions.ts`)
2. Nautilus batch TX builder
3. ErgoPay single TX builder (`api/_lib/ergo-tx-builder.ts`)
4. ErgoPay batch TX builder
5. ErgoPay request endpoint (`api/v2/ergopay/tx/request.ts`) — 3 action types (train, race, treatment)
6. Token TX verification (`api/_lib/verify-tx.ts`)
7. Credit ledger recording

### Pitfall 6: `await` Ledger Inserts in Serverless

**Symptom**: `credit_ledger` entries silently missing — action succeeds but no record.

**Cause**: Vercel kills the serverless function process after sending the HTTP response. Any un-awaited async operations (like `supabase.from('credit_ledger').insert(...)`) are terminated mid-flight.

**Fix**: Always `await` the `recordLedgerEntry()` call before returning the response.

### Pitfall 7: Dual ErgoTree Search

**Symptom**: `findBabelBoxes()` returns empty array even though boxes exist on-chain.

**Cause**: Explorer does exact string matching on ErgoTree. If your boxes were created with the `0x18c101` header but you only search for `0x10`, you'll find nothing.

**Fix**: Search for both header variants. Stop after the first format finds boxes. See `findBabelBoxes()` in Section 2.

### Pitfall 8: Relay DefaultBoxSelector Drops Babel Inputs

**Symptom**: Relay returns `500` with `AssertionError: unexpected selected boxes, expected: Vector(senderBox, babelBox), got ArrayBuffer(senderBox)`. The Babel box is silently dropped.

**Cause**: The Ergo Appkit's `DefaultBoxSelector` (used internally by `UnsignedTransactionBuilder.build()`) does **greedy selection with early stopping**. It iterates input boxes and stops as soon as it has enough ERG + tokens to cover all outputs. If the sender's UTXO alone covers everything (common when the sender has a large balance), the selector never reaches the Babel box input and drops it. The assertion then fails because the selected boxes don't match the expected inputs.

**Why it's intermittent**: The same relay code may work for one sender (small UTXOs, selector needs multiple boxes) and fail for another (one large UTXO covers everything). The bug depends on the sender's wallet UTXO set, not the relay code itself.

**Fix (relay-side)**: The relay must NOT use `UnsignedTransactionBuilder.build()` for Babel TXs, because `build()` always runs the box selector. Instead:

```java
// Option A: Construct the TX at a lower level (bypass selector)
InputBox[] boxes = ctx.getBoxesById(allBoxIds);  // fetch ALL by exact ID
UnsignedErgoLikeTransaction tx = new UnsignedErgoLikeTransaction(
    unsignedInputs,      // ALL inputs preserved, including Babel w/ extension
    dataInputs,
    outputCandidates
);
ReducedErgoLikeTransaction reduced = prover.reduce(ctx, tx, boxes, ...);

// Option B: Upgrade ergo-appkit to a version using InputBoxesValidator
// (pass-through selector that accepts ALL provided boxes without filtering)
```

**Diagnosis checklist**:
1. Check our server logs for `reducedTx payload that failed:` — shows the exact JSON sent to the relay
2. Check the relay's Java stack trace for `unexpected selected boxes`
3. Compare `expected:` (should have 2+ boxes) vs `got:` (will be missing the Babel box)
4. Confirm the sender's UTXO has enough ERG + tokens to cover outputs solo (triggers the early-stop)

---

## 8. Key Files Reference

### Client-Side (Nautilus)

| File | Purpose |
|------|---------|
| `src/lib/ergo/babel.ts` | Babel box discovery, ErgoTree construction, box selection |
| `src/lib/ergo/transactions.ts` | TX builders: `buildAndSubmitTokenFeeTx()`, `buildAndSubmitBatchTokenFeeTx()` |
| `src/lib/ergo/types.ts` | `ErgoBox`, `OutputBox`, `ErgoBoxAsset` interfaces |

### Server-Side (ErgoPay)

| File | Purpose |
|------|---------|
| `api/_lib/babel-discovery.ts` | Server-side Babel box discovery (mirrors client `babel.ts`) |
| `api/_lib/ergo-tx-builder.ts` | Unsigned TX builders: `buildUnsignedTokenFeeTx()`, `buildUnsignedBatchTokenFeeTx()`, `fetchAllUtxos()`, `selectBoxes()` |
| `api/v2/ergopay/tx/request.ts` | ErgoPay payment request endpoint (orchestrates validation + TX build + relay POST) |
| `api/v2/ergopay/tx/callback/[requestId].ts` | Callback from wallet with signed TX ID |
| `api/v2/ergopay/tx/status/[requestId].ts` | Frontend polls for payment confirmation |

### Shared

| File | Purpose |
|------|---------|
| `api/_lib/config.ts` | `getGameConfig(collectionId)` — resolves per-collection fee_token config |
| `api/_lib/verify-tx.ts` | `verifyTokenTxOnChain()`, `isTxIdUsed()` — token TX verification + dedup |
| `api/_lib/execute-action.ts` | Shared action executor (training, race entry, treatment) — token-aware ledger recording |
| `api/_lib/constants.ts` | `TREASURY_ADDRESS`, `TRAINING_FEE_NANOERG`, `REQUIRE_FEES` |

### Sigma Serialization Helpers

Both client and server have ported Sigma serialization (no WASM dependency):

| Function | Format | Used For |
|----------|--------|----------|
| `sigmaSerializeCollByte(data)` | `0x0e` + VLQ(len) + bytes | Register values (R4-R6) |
| `sigmaSerializeUtf8(text)` | Coll[Byte] from UTF-8 | R4 (action type), R6 (context) |
| `sigmaSerializeHex(hex)` | Coll[Byte] from hex | R5 (token ID) |
| `sigmaSerializeSInt(value)` | `0x04` + zigzag VLQ | Context extension (output index) |

---

## Appendix: Token Fee Config Example (Supabase)

```sql
-- collections.game_config_overrides for CyberPets:
{
  "fee_token": {
    "token_id": "01dce8a5632d19799950ff90bca3b5d0ca3ebfa8aaafd06f0cc6dd1e97150e7f",
    "name": "CYPX",
    "decimals": 4,
    "training_fee": 37,
    "default_race_entry_fee": 187,
    "treatment_fees": {
      "stim_pack": 19,
      "cryo_pod": 37,
      "full_reset": 94
    }
  }
}
```

## Appendix: Adding Token Fee Support for a New Collection

1. Add `fee_token` block to the collection's `game_config_overrides` in Supabase
2. Ensure Babel boxes exist on-chain for the new token (someone must create them with the Babel contract parameterized by the token ID)
3. The frontend `PaymentSelector` component auto-detects `fee_token` config and shows the token payment option
4. Both Nautilus and ErgoPay flows will work automatically — no code changes needed
