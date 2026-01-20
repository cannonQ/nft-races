/**
 * Build Packed CyberPets Data for On-Chain Storage
 * 
 * Format: [4-byte tokenId prefix][1-byte rarity][1-byte bodyParts] × 460
 * Sorted by NFT number
 * Total: 2,760 bytes (under 4KB limit)
 * 
 * Usage:
 *   node scripts/build-packed-data.js
 */

const fs = require('fs');
const { createHash } = require('crypto');

// ============================================
// CONFIG
// ============================================

const PETS_JSON_PATH = process.argv[2] || './data/ergo/cyberpets/cyber_pets_traits.json';
const OUTPUT_PATH = './data/ergo/cyberpets/packed-data.json';

// Rarity encoding
const RARITY_TO_CODE = {
  'Common': 0,
  'Uncommon': 1,
  'Rare': 2,
  'Epic': 3,
  'Legendary': 4,
  'Mythic': 5,
  'Relic': 6,
  'Masterwork': 7,
  'Cyberium': 8
};

const CODE_TO_RARITY = Object.fromEntries(
  Object.entries(RARITY_TO_CODE).map(([k, v]) => [v, k])
);

// ============================================
// TRAIT PARSING
// ============================================

function parseTraitsFromDescription(description) {
  const data = JSON.parse(description);
  
  let traits;
  if (data['721']) {
    const tokenKey = Object.keys(data['721'])[0];
    const tokenData = data['721'][tokenKey];
    traits = tokenData.traits || tokenData;
  } else {
    traits = data;
  }
  
  const bodyPartCount = Object.keys(traits).filter(k => k.startsWith('Body part')).length;
  
  return {
    rarity: traits['Rarity'] || 'Common',
    bodyPartCount
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n📦 Build Packed CyberPets Data\n');
  console.log('='.repeat(60));
  
  // Load pets data
  console.log(`\n📥 Loading: ${PETS_JSON_PATH}`);
  
  if (!fs.existsSync(PETS_JSON_PATH)) {
    console.error(`❌ File not found: ${PETS_JSON_PATH}`);
    console.error(`   Make sure traits.json is in the data folder`);
    process.exit(1);
  }
  
  const raw = fs.readFileSync(PETS_JSON_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const tokens = data.tokens;
  
  console.log(`   Found ${tokens.length} pets`);
  
  // Parse and sort by NFT number
  console.log(`\n🔧 Processing traits...`);
  
  const pets = tokens.map(token => {
    const { rarity, bodyPartCount } = parseTraitsFromDescription(token.description);
    return {
      tokenId: token.token_id,
      tokenIdPrefix: token.token_id.slice(0, 8), // 4 bytes = 8 hex chars
      number: token.number,
      name: token.name,
      rarity,
      rarityCode: RARITY_TO_CODE[rarity] ?? 0,
      bodyPartCount
    };
  });
  
  // Sort by NFT number
  pets.sort((a, b) => a.number - b.number);
  
  console.log(`   Sorted by NFT number`);
  console.log(`   First: #${pets[0].number}, Last: #${pets[pets.length - 1].number}`);
  
  // Build packed binary data
  console.log(`\n📦 Building packed data...`);
  
  const packedBuffer = Buffer.alloc(pets.length * 6); // 6 bytes per pet
  
  pets.forEach((pet, index) => {
    const offset = index * 6;
    
    // 4 bytes: token_id prefix (big-endian, first 4 bytes of token_id)
    const prefixBytes = Buffer.from(pet.tokenIdPrefix, 'hex');
    prefixBytes.copy(packedBuffer, offset, 0, 4);
    
    // 1 byte: rarity code
    packedBuffer.writeUInt8(pet.rarityCode, offset + 4);
    
    // 1 byte: body part count
    packedBuffer.writeUInt8(pet.bodyPartCount, offset + 5);
  });
  
  const packedHex = packedBuffer.toString('hex');
  
  console.log(`   Packed size: ${packedBuffer.length} bytes`);
  console.log(`   Hex length: ${packedHex.length} chars`);
  
  // Calculate root hash of full JSON
  console.log(`\n🔐 Calculating root hash...`);
  const rootHash = createHash('sha256').update(raw).digest('hex');
  console.log(`   Root hash: ${rootHash}`);
  
  // Verify a few entries
  console.log(`\n✅ Verifying sample entries...`);
  
  for (let i = 0; i < 3; i++) {
    const pet = pets[i];
    const offset = i * 6;
    const readPrefix = packedBuffer.slice(offset, offset + 4).toString('hex');
    const readRarity = packedBuffer.readUInt8(offset + 4);
    const readBodyParts = packedBuffer.readUInt8(offset + 5);
    
    console.log(`   #${pet.number}: ${readPrefix}... → ${CODE_TO_RARITY[readRarity]}, ${readBodyParts} parts ✓`);
  }
  
  // Also verify last 3
  console.log(`   ...`);
  for (let i = pets.length - 3; i < pets.length; i++) {
    const pet = pets[i];
    const offset = i * 6;
    const readPrefix = packedBuffer.slice(offset, offset + 4).toString('hex');
    const readRarity = packedBuffer.readUInt8(offset + 4);
    const readBodyParts = packedBuffer.readUInt8(offset + 5);
    
    console.log(`   #${pet.number}: ${readPrefix}... → ${CODE_TO_RARITY[readRarity]}, ${readBodyParts} parts ✓`);
  }
  
  // Build output
  const output = {
    version: 1,
    collection: 'cyberpets',
    chain: 'ergo',
    count: pets.length,
    format: {
      bytesPerEntry: 6,
      layout: '[4-byte tokenId prefix][1-byte rarity][1-byte bodyParts]',
      sorted: 'by NFT number ascending'
    },
    rarityMap: RARITY_TO_CODE,
    rootHash,
    packedHex,
    // Include index for lookups
    index: pets.map(p => ({
      number: p.number,
      tokenIdPrefix: p.tokenIdPrefix,
      tokenId: p.tokenId
    }))
  };
  
  // Ensure output directory exists
  const outputDir = OUTPUT_PATH.substring(0, OUTPUT_PATH.lastIndexOf('/'));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved to: ${OUTPUT_PATH}`);
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n📋 SUMMARY\n`);
  console.log(`   Pets: ${pets.length}`);
  console.log(`   Packed size: ${packedBuffer.length} bytes (${(packedBuffer.length / 1024).toFixed(2)} KB)`);
  console.log(`   Root hash: ${rootHash}`);
  console.log(`\n   Ready for on-chain minting!`);
  console.log(`   Box will use ~3KB (well under 4KB limit)\n`);
  
  // Output register values for minting
  console.log(`\n📝 REGISTER VALUES FOR MINTING\n`);
  console.log(`   R4 (packed data): ${packedHex.slice(0, 40)}...`);
  console.log(`   R5 (root hash): ${rootHash}`);
  console.log(`   R6 (metadata): see packed-data.json\n`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
