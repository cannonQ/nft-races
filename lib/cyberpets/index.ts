/**
 * CyberPets Data Utilities
 *
 * Provides functions to:
 * - Load and index CyberPet data from cyber_pet_traits.json
 * - Filter NFTs to only CyberPets
 * - Parse traits from description
 * - Calculate racing score
 */

import cyberPetData from '@/data/ergo/cyberpets/cyber_pet_traits.json';

// Rarity multipliers for racing speed
const RARITY_MULTIPLIERS: Record<string, number> = {
  'Common': 1.00,
  'Uncommon': 1.01,
  'Rare': 1.02,
  'Epic': 1.04,
  'Legendary': 1.05,
  'Mythic': 1.06,
  'Relic': 1.07,
  'Masterwork': 1.08,
  'Cyberium': 1.10,
};

// Rarity display order (for sorting)
const RARITY_ORDER: Record<string, number> = {
  'Cyberium': 0,
  'Masterwork': 1,
  'Relic': 2,
  'Mythic': 3,
  'Legendary': 4,
  'Epic': 5,
  'Rare': 6,
  'Uncommon': 7,
  'Common': 8,
};

export interface CyberPetTraits {
  number: number;
  rarity: string;
  pet: string;
  skinColor: string;
  background: string;
  stage: string;
  bodyParts: string[];
}

export interface CyberPetInfo {
  tokenId: string;
  name: string;
  number: number;
  traits: CyberPetTraits;
  racingScore: number;
  imageUrl: string;
}

// Build index of token IDs to CyberPet data
const tokenIndex = new Map<string, typeof cyberPetData.tokens[0]>();
for (const token of cyberPetData.tokens) {
  tokenIndex.set(token.token_id, token);
}

// Set of all valid CyberPet token IDs
const validTokenIds = new Set(cyberPetData.tokens.map(t => t.token_id));

/**
 * Check if a token ID is a valid CyberPet
 */
export function isCyberPet(tokenId: string): boolean {
  return validTokenIds.has(tokenId);
}

/**
 * Get all valid CyberPet token IDs
 */
export function getAllCyberPetTokenIds(): string[] {
  return Array.from(validTokenIds);
}

/**
 * Parse traits from the description JSON string
 */
export function parseTraits(description: string): CyberPetTraits | null {
  try {
    const parsed = JSON.parse(description);

    // Handle two formats:
    // 1. Old format: { "CyberPet": "1906", "Rarity": "Cyberium", ... }
    // 2. New format: { "721": { "1906": { "traits": { ... } } } }

    let traits: Record<string, string>;

    if (parsed['721']) {
      // New format - find the traits object
      const petNumbers = Object.keys(parsed['721']);
      if (petNumbers.length > 0) {
        traits = parsed['721'][petNumbers[0]].traits || parsed['721'][petNumbers[0]];
      } else {
        return null;
      }
    } else {
      // Old format
      traits = parsed;
    }

    // Extract body parts
    const bodyParts: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const partKey = `Body part ${i}`;
      if (traits[partKey]) {
        bodyParts.push(traits[partKey]);
      }
    }

    return {
      number: parseInt(traits['CyberPet'] || '0'),
      rarity: traits['Rarity'] || 'Common',
      pet: traits['Pet'] || 'Unknown',
      skinColor: traits['Skin Color'] || 'Unknown',
      background: traits['Background'] || 'Unknown',
      stage: traits['Stage'] || '1',
      bodyParts,
    };
  } catch {
    return null;
  }
}

/**
 * Calculate racing score based on rarity and body parts
 * Higher score = better racer
 */
export function calculateRacingScore(traits: CyberPetTraits): number {
  const rarityMultiplier = RARITY_MULTIPLIERS[traits.rarity] || 1.00;
  const bodyPartBonus = traits.bodyParts.length * 0.01; // Each body part adds 0.01

  // Score = base (100) * rarity multiplier + body part bonus
  const score = Math.round((100 * rarityMultiplier + bodyPartBonus * 100) * 10) / 10;
  return score;
}

// CyberPets IPFS base CID for images
const CYBERPETS_IPFS_CID = 'QmeQZUQJiKQYZ2dQ795491ykn1ikEv3bNJ1Aa1uyGs1aJw';

/**
 * Get image URL for a CyberPet
 * Format: https://api.ergexplorer.com/nftcache/{ipfs_cid}_{number}.png.png
 */
export function getImageUrl(tokenId: string, petNumber: number): string {
  return `https://api.ergexplorer.com/nftcache/${CYBERPETS_IPFS_CID}_${petNumber}.png.png`;
}

/**
 * Get fallback image URL from cyberversewiki.com
 */
export function getFallbackImageUrl(petNumber: number): string {
  return `https://www.cyberversewiki.com/img/cyberpets/${petNumber}.png`;
}

/**
 * Get full CyberPet info for a token ID
 */
export function getCyberPetInfo(tokenId: string): CyberPetInfo | null {
  const token = tokenIndex.get(tokenId);
  if (!token) return null;

  const traits = parseTraits(token.description);
  if (!traits) return null;

  return {
    tokenId: token.token_id,
    name: token.name,
    number: token.number,
    traits,
    racingScore: calculateRacingScore(traits),
    imageUrl: getImageUrl(token.token_id, token.number),
  };
}

/**
 * Filter an array of NFTs to only include CyberPets
 * and return enriched data
 */
export function filterAndEnrichCyberPets(
  nfts: Array<{ tokenId: string; name: string }>
): CyberPetInfo[] {
  const cyberPets: CyberPetInfo[] = [];

  for (const nft of nfts) {
    const info = getCyberPetInfo(nft.tokenId);
    if (info) {
      cyberPets.push(info);
    }
  }

  // Sort by rarity (best first), then by racing score
  cyberPets.sort((a, b) => {
    const rarityDiff = (RARITY_ORDER[a.traits.rarity] || 99) - (RARITY_ORDER[b.traits.rarity] || 99);
    if (rarityDiff !== 0) return rarityDiff;
    return b.racingScore - a.racingScore;
  });

  return cyberPets;
}

/**
 * Get rarity color for display
 */
export function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    'Cyberium': '#ff00ff',    // Magenta
    'Masterwork': '#ffd700',  // Gold
    'Relic': '#ff6b00',       // Orange
    'Mythic': '#9400d3',      // Purple
    'Legendary': '#ff4500',   // Red-orange
    'Epic': '#9932cc',        // Dark orchid
    'Rare': '#4169e1',        // Royal blue
    'Uncommon': '#32cd32',    // Lime green
    'Common': '#808080',      // Gray
  };
  return colors[rarity] || '#808080';
}

/**
 * Get all CyberPets data (for house NFT selection)
 */
export function getAllCyberPets(): CyberPetInfo[] {
  const pets: CyberPetInfo[] = [];
  for (const token of cyberPetData.tokens) {
    const info = getCyberPetInfo(token.token_id);
    if (info) {
      pets.push(info);
    }
  }
  return pets;
}

/**
 * Get total count of CyberPets
 */
export function getCyberPetCount(): number {
  return cyberPetData.tokens.length;
}

/**
 * Get a CyberPet by index (for seeded random selection)
 */
export function getCyberPetByIndex(index: number): CyberPetInfo | null {
  const safeIndex = index % cyberPetData.tokens.length;
  const token = cyberPetData.tokens[safeIndex];
  if (!token) return null;
  return getCyberPetInfo(token.token_id);
}

/**
 * House wallet address for house NFT entries
 */
export const HOUSE_WALLET_ADDRESS = '9gbgJTNXUcdqRp2Tq8hjwnw8B5qvFSWFgDbuDKRRsNjUPjgC3vm';

// Re-export RARITY_MULTIPLIERS for use in race resolution
export { RARITY_MULTIPLIERS };
