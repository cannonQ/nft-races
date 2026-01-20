/**
 * Mint Packed CyberPets Data Box on Ergo
 * 
 * Stores compact trait data on-chain (under 4KB)
 * 
 * Usage:
 *   node scripts/mint-packed-box.js
 * 
 * Registers:
 *   R4: Packed data [4-byte prefix + 1-byte rarity + 1-byte bodyParts] × 460
 *   R5: Root hash of full GitHub JSON (32 bytes)
 *   R6: Metadata JSON
 */

require('dotenv').config({ path: '.env.local' });

const {
  OutputBuilder,
  TransactionBuilder,
  SAFE_MIN_BOX_VALUE
} = require('@fleet-sdk/core');
const ergolib = require('ergo-lib-wasm-nodejs');
const fs = require('fs');

// ============================================
// CONFIG
// ============================================

const ERGO_EXPLORER_API = 'https://api.ergoplatform.com/api/v1';
const PACKED_DATA_PATH = './data/ergo/cyberpets/packed-data.json';
const BOX_VALUE = 10_000_000n; // 0.01 ERG
const TX_FEE = 1_100_000n; // 0.0011 ERG

const GITHUB_URL = 'https://raw.githubusercontent.com/cannonQ/nft-races/main/data/ergo/cyberpets/cyber_pets_traits.json';

// ============================================
// HELPERS
// ============================================

async function getWalletAddress(mnemonic) {
  const seed = ergolib.Mnemonic.to_seed(mnemonic, '');
  const rootSecret = ergolib.ExtSecretKey.derive_master(seed);
  const path = ergolib.DerivationPath.new(0, new Uint32Array([0]));
  const secretKey = rootSecret.derive(path);
  
  const address = secretKey
    .public_key()
    .to_address()
    .to_base58(ergolib.NetworkPrefix.Mainnet);
  
  const sk = ergolib.SecretKey.dlog_from_bytes(secretKey.secret_key_bytes());
  const secretKeys = new ergolib.SecretKeys();
  secretKeys.add(sk);
  const wallet = ergolib.Wallet.from_secrets(secretKeys);
  
  return { wallet, address, secretKey };
}

async function getUtxos(address) {
  const response = await fetch(
    `${ERGO_EXPLORER_API}/boxes/unspent/byAddress/${address}?limit=50`
  );
  const data = await response.json();
  return data.items || [];
}

async function getCurrentHeight() {
  const response = await fetch(`${ERGO_EXPLORER_API}/blocks?limit=1`);
  const data = await response.json();
  return data.items[0].height;
}

async function submitTransaction(signedTx, nodeUrl) {
  const txJson = signedTx.to_json();
  
  console.log(`   Trying node: ${nodeUrl}/transactions`);
  try {
    const nodeResponse = await fetch(`${nodeUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: txJson
    });
    
    const nodeResult = await nodeResponse.text();
    console.log(`   Node response (${nodeResponse.status}): ${nodeResult.slice(0, 200)}`);
    
    if (nodeResponse.ok) {
      return { id: nodeResult.replace(/"/g, '') };
    } else {
      console.log(`   Node rejected, trying explorer...`);
    }
  } catch (e) {
    console.log(`   Node error: ${e.message}, trying explorer...`);
  }
  
  console.log(`   Trying explorer API...`);
  const response = await fetch(`${ERGO_EXPLORER_API}/mempool/transactions/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: txJson
  });
  
  const explorerResult = await response.text();
  console.log(`   Explorer response (${response.status}): ${explorerResult.slice(0, 200)}`);
  
  if (!response.ok) {
    throw new Error(`Failed to submit: ${explorerResult}`);
  }
  
  return JSON.parse(explorerResult);
}

// Convert hex string to SConstant Coll[Byte] format
function hexToCollByte(hexStr) {
  const bytes = Buffer.from(hexStr, 'hex');
  const len = bytes.length;
  
  let vlq = [];
  let n = len;
  while (n >= 128) {
    vlq.push((n & 0x7f) | 0x80);
    n >>= 7;
  }
  vlq.push(n);
  
  const result = Buffer.concat([
    Buffer.from([0x0e]),
    Buffer.from(vlq),
    bytes
  ]);
  
  return result.toString('hex');
}

function stringToCollByte(str) {
  return hexToCollByte(Buffer.from(str, 'utf-8').toString('hex'));
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n🏦 Mint Packed CyberPets Box\n');
  console.log('='.repeat(60));
  
  // Check mnemonic
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    console.error('❌ Set MNEMONIC in .env.local');
    process.exit(1);
  }
  
  // Load packed data
  if (!fs.existsSync(PACKED_DATA_PATH)) {
    console.error(`❌ Packed data not found: ${PACKED_DATA_PATH}`);
    console.error('   Run: node scripts/build-packed-data.js first');
    process.exit(1);
  }
  
  const packedData = JSON.parse(fs.readFileSync(PACKED_DATA_PATH, 'utf-8'));
  
  console.log(`\n📋 Packed Data:`);
  console.log(`   Pets: ${packedData.count}`);
  console.log(`   Size: ${packedData.packedHex.length / 2} bytes`);
  console.log(`   Root hash: ${packedData.rootHash}`);
  
  // Get wallet
  console.log(`\n🔑 Loading wallet...`);
  const { wallet, address } = await getWalletAddress(mnemonic);
  console.log(`   Address: ${address}`);
  
  // Get UTXOs
  console.log(`\n📥 Fetching UTXOs...`);
  const utxos = await getUtxos(address);
  console.log(`   Found ${utxos.length} boxes`);
  
  const totalErg = utxos.reduce((sum, box) => sum + BigInt(box.value), 0n);
  console.log(`   Total: ${Number(totalErg) / 1e9} ERG`);
  
  const required = BOX_VALUE + TX_FEE;
  if (totalErg < required) {
    console.error(`❌ Insufficient funds. Need ${Number(required) / 1e9} ERG`);
    process.exit(1);
  }
  
  // Get current height
  const height = await getCurrentHeight();
  console.log(`   Height: ${height}`);
  
  // Prepare register values
  console.log(`\n📦 Preparing registers...`);
  
  const r4 = hexToCollByte(packedData.packedHex);
  const r5 = hexToCollByte(packedData.rootHash);
  
  const metadata = JSON.stringify({
    version: packedData.version,
    collection: packedData.collection,
    chain: packedData.chain,
    count: packedData.count,
    format: packedData.format,
    github: GITHUB_URL
  });
  const r6 = stringToCollByte(metadata);
  
  console.log(`   R4 (packed): ${r4.substring(0, 40)}... (${packedData.packedHex.length / 2} bytes)`);
  console.log(`   R5 (hash): ${packedData.rootHash}`);
  console.log(`   R6 (meta): ${metadata.substring(0, 60)}...`);
  
  // Build transaction
  console.log(`\n🔨 Building transaction...`);
  
  const inputs = utxos.map(box => ({
    boxId: box.boxId,
    transactionId: box.transactionId,
    index: box.index,
    value: box.value.toString(),
    ergoTree: box.ergoTree,
    assets: box.assets || [],
    creationHeight: box.creationHeight,
    additionalRegisters: box.additionalRegisters || {}
  }));
  
  const output = new OutputBuilder(BOX_VALUE.toString(), address)
    .setAdditionalRegisters({
      R4: r4,
      R5: r5,
      R6: r6
    });
  
  const unsignedTx = new TransactionBuilder(height)
    .from(inputs)
    .to([output])
    .sendChangeTo(address)
    .payFee(TX_FEE.toString())
    .build()
    .toEIP12Object();
  
  console.log(`   Inputs: ${unsignedTx.inputs.length}`);
  console.log(`   Outputs: ${unsignedTx.outputs.length}`);
  
  // Sign transaction
  console.log(`\n✍️ Signing transaction...`);
  
  try {
    const nodeEndpoints = [
      'http://213.239.193.208:9053',
      'http://159.65.11.55:9053'
    ];
    
    let headersData = null;
    let workingNodeUrl = null;
    
    for (const nodeUrl of nodeEndpoints) {
      try {
        console.log(`   Trying node: ${nodeUrl}...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const headersResponse = await fetch(`${nodeUrl}/blocks/lastHeaders/10`, {
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (headersResponse.ok) {
          headersData = await headersResponse.json();
          workingNodeUrl = nodeUrl;
          console.log(`   ✓ Got headers from ${nodeUrl}`);
          break;
        }
      } catch (e) {
        console.log(`   ✗ ${nodeUrl} failed`);
      }
    }
    
    if (!headersData) {
      throw new Error('Could not fetch headers from any node');
    }
    
    const blockHeaders = ergolib.BlockHeaders.from_json(headersData);
    const preHeader = ergolib.PreHeader.from_block_header(blockHeaders.get(0));
    const parameters = ergolib.Parameters.default_parameters();
    const stateCtx = new ergolib.ErgoStateContext(preHeader, blockHeaders, parameters);
    
    const unsignedTxParsed = ergolib.UnsignedTransaction.from_json(JSON.stringify(unsignedTx));
    
    const inputBoxes = ergolib.ErgoBoxes.empty();
    for (const utxo of utxos.slice(0, unsignedTx.inputs.length)) {
      const box = ergolib.ErgoBox.from_json(JSON.stringify({
        boxId: utxo.boxId,
        value: utxo.value,
        ergoTree: utxo.ergoTree,
        assets: utxo.assets || [],
        creationHeight: utxo.creationHeight,
        transactionId: utxo.transactionId,
        index: utxo.index,
        additionalRegisters: utxo.additionalRegisters || {}
      }));
      inputBoxes.add(box);
    }
    
    const signedTx = wallet.sign_transaction(
      stateCtx,
      unsignedTxParsed,
      inputBoxes,
      ergolib.ErgoBoxes.empty()
    );
    
    console.log(`   ✅ Transaction signed`);
    
    // Submit
    console.log(`\n📤 Submitting transaction...`);
    const result = await submitTransaction(signedTx, workingNodeUrl);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n✅ PACKED DATA BOX MINTED!\n`);
    console.log(`   TX ID: ${result.id}`);
    console.log(`   Explorer: https://explorer.ergoplatform.com/en/transactions/${result.id}`);
    console.log(`\n   Data: ${packedData.count} pets, ${packedData.packedHex.length / 2} bytes`);
    console.log(`   Root hash: ${packedData.rootHash}`);
    console.log(`\n   Remember to push traits.json to GitHub!\n`);
    
  } catch (err) {
    console.error(`\n❌ Failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
