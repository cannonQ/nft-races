/**
 * CyberPets Race Engine
 * Deterministic race simulation from combined seed
 */

import seedrandom from 'seedrandom';
import { createHash } from 'crypto';

export interface RaceEntry {
  nftTokenId: string;
  nftName: string;
  ownerAddress: string;
  signature: string;
  speedMultiplier: number;
  consistency: number;
  isHouseNft: boolean;
}

export interface SegmentResult {
  nftTokenId: string;
  segmentDistance: number;
  totalDistance: number;
}

export interface RaceResult {
  nftTokenId: string;
  nftName: string;
  ownerAddress: string;
  position: number;
  finalDistance: number;
  isHouseNft: boolean;
  payoutAmount: number; // in nanoERG
}

export interface RaceSimulation {
  combinedSeed: string;
  segments: SegmentResult[][];
  results: RaceResult[];
  totalPot: number;
}

// Payout split: 50% / 30% / 15% / 5% house
const PAYOUT_SPLIT = {
  1: 0.50,
  2: 0.30,
  3: 0.15,
  house: 0.05
};

const RACE_SEGMENTS = 10;

/**
 * Combine all seeds into one deterministic seed
 */
export function combineSeed(serverSeed: string, signatures: string[]): string {
  // Sort signatures for determinism
  const sortedSigs = [...signatures].sort();
  const combined = serverSeed + sortedSigs.join('');
  return createHash('sha256').update(combined).digest('hex');
}

/**
 * Verify server seed matches published hash
 */
export function verifyServerSeed(serverSeed: string, publishedHash: string): boolean {
  const hash = createHash('sha256').update(serverSeed).digest('hex');
  return hash === publishedHash;
}

/**
 * Generate server seed and hash
 */
export function generateServerSeed(): { seed: string; hash: string } {
  const seed = createHash('sha256')
    .update(crypto.randomUUID() + Date.now().toString())
    .digest('hex');
  const hash = createHash('sha256').update(seed).digest('hex');
  return { seed, hash };
}

/**
 * Simulate a single race segment for one pet
 */
function simulateSegment(
  rng: () => number,
  speedMultiplier: number,
  consistency: number
): number {
  const baseRoll = rng() * 100;
  
  // Lower consistency = more variance
  const variance = (1 - consistency) * 40;
  const swing = (rng() - 0.5) * variance;
  
  return (baseRoll + swing) * speedMultiplier;
}

/**
 * Run the full race simulation
 */
export function simulateRace(
  combinedSeed: string,
  entries: RaceEntry[],
  entryFee: number // in nanoERG
): RaceSimulation {
  const rng = seedrandom(combinedSeed);
  
  // Initialize distances
  const distances: Map<string, number> = new Map();
  entries.forEach(e => distances.set(e.nftTokenId, 0));
  
  // Track segment history for replay
  const segments: SegmentResult[][] = [];
  
  // Run each segment
  for (let seg = 0; seg < RACE_SEGMENTS; seg++) {
    const segmentResults: SegmentResult[] = [];
    
    for (const entry of entries) {
      const segmentDistance = simulateSegment(
        rng,
        entry.speedMultiplier,
        entry.consistency
      );
      
      const newTotal = (distances.get(entry.nftTokenId) || 0) + segmentDistance;
      distances.set(entry.nftTokenId, newTotal);
      
      segmentResults.push({
        nftTokenId: entry.nftTokenId,
        segmentDistance,
        totalDistance: newTotal
      });
    }
    
    segments.push(segmentResults);
  }
  
  // Sort by final distance (descending)
  const sorted = entries
    .map(e => ({
      ...e,
      finalDistance: distances.get(e.nftTokenId) || 0
    }))
    .sort((a, b) => b.finalDistance - a.finalDistance);
  
  // Calculate pot and payouts
  const totalPot = entries.length * entryFee;
  const houseCut = Math.floor(totalPot * PAYOUT_SPLIT.house);
  const prizePot = totalPot - houseCut;
  
  // Build results with payouts
  const results: RaceResult[] = sorted.map((entry, index) => {
    const position = index + 1;
    let payoutAmount = 0;
    
    if (position === 1) {
      payoutAmount = Math.floor(prizePot * PAYOUT_SPLIT[1]);
    } else if (position === 2) {
      payoutAmount = Math.floor(prizePot * PAYOUT_SPLIT[2]);
    } else if (position === 3) {
      payoutAmount = Math.floor(prizePot * PAYOUT_SPLIT[3]);
    }
    
    return {
      nftTokenId: entry.nftTokenId,
      nftName: entry.nftName,
      ownerAddress: entry.ownerAddress,
      position,
      finalDistance: Math.round(entry.finalDistance * 100) / 100,
      isHouseNft: entry.isHouseNft,
      payoutAmount
    };
  });
  
  return {
    combinedSeed,
    segments,
    results,
    totalPot
  };
}

/**
 * Public verification function
 * Anyone can re-run this to verify results
 */
export function verifyRace(
  serverSeed: string,
  serverSeedHash: string,
  entries: RaceEntry[],
  entryFee: number,
  publishedResults: RaceResult[]
): { valid: boolean; reason?: string } {
  // 1. Verify server seed matches hash
  if (!verifyServerSeed(serverSeed, serverSeedHash)) {
    return { valid: false, reason: 'Server seed does not match published hash' };
  }
  
  // 2. Recompute combined seed
  const signatures = entries.map(e => e.signature);
  const combinedSeed = combineSeed(serverSeed, signatures);
  
  // 3. Re-run simulation
  const simulation = simulateRace(combinedSeed, entries, entryFee);
  
  // 4. Compare results
  for (let i = 0; i < publishedResults.length; i++) {
    const published = publishedResults[i];
    const computed = simulation.results[i];
    
    if (published.nftTokenId !== computed.nftTokenId ||
        published.position !== computed.position ||
        published.finalDistance !== computed.finalDistance) {
      return { 
        valid: false, 
        reason: `Mismatch at position ${i + 1}: expected ${computed.nftTokenId}, got ${published.nftTokenId}` 
      };
    }
  }
  
  return { valid: true };
}
