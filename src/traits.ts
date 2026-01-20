/**
 * CyberPets Trait Parser
 * Handles both JSON formats found in on-chain data
 */

export interface PetTraits {
  rarity: string;
  pet: string;
  skinColor: string;
  background: string;
  stage: number;
  bodyPartCount: number;
  bodyParts: string[];
}

export interface PetStats {
  speedMultiplier: number;
  consistency: number;
}

// Rarity multipliers (10% max edge)
const RARITY_MULTIPLIER: Record<string, number> = {
  'Common': 1.00,
  'Uncommon': 1.01,
  'Rare': 1.02,
  'Epic': 1.04,
  'Legendary': 1.05,
  'Mythic': 1.06,
  'Relic': 1.07,
  'Masterwork': 1.08,
  'Cyberium': 1.10
};

/**
 * Parse traits from CyberPet description field
 * Handles two formats:
 * 1. Direct: { "Rarity": "Common", "Pet": "Cat", ... }
 * 2. Nested: { "721": { "123": { "traits": { ... } } } }
 */
export function parseTraits(description: string): PetTraits {
  const data = JSON.parse(description);
  
  let traits: Record<string, string>;
  
  // Handle nested 721 format
  if (data['721']) {
    const tokenKey = Object.keys(data['721'])[0];
    const tokenData = data['721'][tokenKey];
    traits = tokenData.traits || tokenData;
  } else {
    traits = data;
  }
  
  // Extract body parts
  const bodyParts: string[] = [];
  for (const key of Object.keys(traits)) {
    if (key.startsWith('Body part')) {
      bodyParts.push(traits[key]);
    }
  }
  
  return {
    rarity: traits['Rarity'] || 'Common',
    pet: traits['Pet'] || 'Unknown',
    skinColor: traits['Skin Color'] || 'Unknown',
    background: traits['Background'] || 'Unknown',
    stage: parseInt(traits['Stage'] || '1', 10),
    bodyPartCount: bodyParts.length,
    bodyParts
  };
}

/**
 * Calculate race stats from traits
 */
export function calculateStats(traits: PetTraits): PetStats {
  const speedMultiplier = RARITY_MULTIPLIER[traits.rarity] || 1.00;
  
  // Consistency: 0.50 base + 0.04 per body part (max 8 parts = 0.82)
  const consistency = Math.min(0.50 + (traits.bodyPartCount * 0.04), 0.82);
  
  return {
    speedMultiplier: Math.round(speedMultiplier * 100) / 100,
    consistency: Math.round(consistency * 100) / 100
  };
}

/**
 * Parse and calculate stats in one call
 */
export function getStatsFromDescription(description: string): { traits: PetTraits; stats: PetStats } {
  const traits = parseTraits(description);
  const stats = calculateStats(traits);
  return { traits, stats };
}
