import { useState, useEffect, useCallback } from 'react';
import { Race, RaceResults, RaceEntry, EnterRaceResponse, ApiResponse, MutationResponse } from '@/types/game';
import { API_BASE, delay } from './config';

// Mock races data
const mockRaces: Race[] = [
  {
    id: 'race_001',
    name: 'Neon Thunder Sprint',
    raceType: 'sprint',
    entryFee: 50,
    maxEntries: 8,
    entryCount: 5,
    entryDeadline: '2026-02-07T18:00:00Z',
    status: 'open',
  },
  {
    id: 'race_002',
    name: 'Endurance Marathon',
    raceType: 'distance',
    entryFee: 100,
    maxEntries: 12,
    entryCount: 8,
    entryDeadline: '2026-02-07T20:00:00Z',
    status: 'open',
  },
  {
    id: 'race_003',
    name: 'Technical Challenge',
    raceType: 'technical',
    entryFee: 75,
    maxEntries: 6,
    entryCount: 6,
    entryDeadline: '2026-02-07T16:00:00Z',
    status: 'locked',
  },
  {
    id: 'race_004',
    name: 'Hazard Run',
    raceType: 'hazard',
    entryFee: 150,
    maxEntries: 8,
    entryCount: 3,
    entryDeadline: '2026-02-08T12:00:00Z',
    status: 'upcoming',
  },
  {
    id: 'race_005',
    name: 'Grand Prix Finals',
    raceType: 'mixed',
    entryFee: 200,
    maxEntries: 10,
    entryCount: 10,
    entryDeadline: '2026-02-06T18:00:00Z',
    status: 'resolved',
  },
];

// Mock race results
const mockRaceResults: Record<string, RaceResults> = {
  'race_005': {
    race: {
      ...mockRaces[4],
      totalEntrants: 10,
      totalPrizePool: 2000,
      completedAt: '2026-02-06T18:00:00Z',
    },
    entries: [
      {
        position: 1,
        creatureId: 'creature_003',
        creatureName: 'Neon Phantom',
        rarity: 'legendary',
        ownerId: 'user_001',
        ownerAddress: '0x7a3B...4f2E',
        performanceScore: 892,
        payout: 1000,
        reward: '+1 Action',
        breakdown: {
          effectiveStats: { speed: 115, stamina: 105, accel: 110, agility: 100, heart: 93, focus: 87 },
          weightedScore: 850,
          fatigueMod: -15,
          sharpnessMod: 12,
          rngMod: 45,
          finalScore: 892,
        },
      },
      {
        position: 2,
        creatureId: 'creature_002',
        creatureName: 'Shadow Runner',
        rarity: 'epic',
        ownerId: 'user_001',
        ownerAddress: '0x7a3B...4f2E',
        performanceScore: 845,
        payout: 600,
        reward: '+50% Boost',
        breakdown: {
          effectiveStats: { speed: 98, stamina: 90, accel: 97, agility: 84, heart: 73, focus: 70 },
          weightedScore: 820,
          fatigueMod: -5,
          sharpnessMod: 18,
          rngMod: 12,
          finalScore: 845,
        },
      },
      {
        position: 3,
        creatureId: 'creature_001',
        creatureName: 'Volt Striker',
        rarity: 'rare',
        ownerId: 'user_001',
        ownerAddress: '0x7a3B...4f2E',
        performanceScore: 798,
        payout: 300,
        reward: '+25% Boost',
        breakdown: {
          effectiveStats: { speed: 87, stamina: 68, accel: 75, agility: 75, heart: 58, focus: 57 },
          weightedScore: 780,
          fatigueMod: -10,
          sharpnessMod: 8,
          rngMod: 20,
          finalScore: 798,
        },
      },
      {
        position: 4,
        creatureId: 'creature_ext_001',
        creatureName: 'Thunder Bolt',
        rarity: 'rare',
        ownerId: 'user_002',
        ownerAddress: '0x3c1F...8a2D',
        performanceScore: 756,
        payout: 100,
        reward: '+10% Boost',
      },
      {
        position: 5,
        creatureId: 'creature_ext_002',
        creatureName: 'Storm Chaser',
        rarity: 'uncommon',
        ownerId: 'user_003',
        ownerAddress: '0x9d4E...2c1A',
        performanceScore: 712,
        payout: 0,
        reward: '+10% Boost',
      },
      {
        position: 6,
        creatureId: 'creature_004',
        creatureName: 'Circuit Breaker',
        rarity: 'uncommon',
        ownerId: 'user_001',
        ownerAddress: '0x7a3B...4f2E',
        performanceScore: 678,
        payout: 0,
        reward: '+10% Boost',
      },
    ],
  },
  'race_past_001': {
    race: {
      id: 'race_past_001',
      name: 'Neon Thunder Sprint',
      raceType: 'sprint',
      entryFee: 50,
      maxEntries: 8,
      entryCount: 8,
      entryDeadline: '2026-02-05T16:00:00Z',
      status: 'resolved',
      totalEntrants: 8,
      totalPrizePool: 2700,
      completedAt: '2026-02-05T18:00:00Z',
    },
    entries: [
      {
        position: 1,
        creatureId: 'creature_003',
        creatureName: 'Cyber Phantom',
        rarity: 'cyberium',
        ownerId: 'user_001',
        ownerAddress: '0x7a3B...4f2E',
        performanceScore: 9850,
        payout: 1500,
        reward: '+1 Action',
        breakdown: {
          effectiveStats: { speed: 92, stamina: 88, accel: 90, agility: 86, heart: 82, focus: 85 },
          weightedScore: 8200,
          fatigueMod: 850,
          sharpnessMod: 800,
          rngMod: 0,
          finalScore: 9850,
        },
      },
      {
        position: 2,
        creatureId: 'creature_ext_001',
        creatureName: 'Thunder Bolt',
        rarity: 'legendary',
        ownerId: 'user_002',
        ownerAddress: '0x3c1F...8a2D',
        performanceScore: 9200,
        payout: 800,
        reward: '+50% Boost',
      },
      {
        position: 3,
        creatureId: 'creature_001',
        creatureName: 'Voltex Prime',
        rarity: 'legendary',
        ownerId: 'user_001',
        ownerAddress: '0x7a3B...4f2E',
        performanceScore: 8900,
        payout: 400,
        reward: '+25% Boost',
        breakdown: {
          effectiveStats: { speed: 85, stamina: 70, accel: 80, agility: 75, heart: 65, focus: 72 },
          weightedScore: 7500,
          fatigueMod: 680,
          sharpnessMod: 720,
          rngMod: 0,
          finalScore: 8900,
        },
      },
      {
        position: 4,
        creatureId: 'creature_ext_002',
        creatureName: 'Plasma Storm',
        rarity: 'mythic',
        ownerId: 'user_003',
        ownerAddress: '0x9d4E...2c1A',
        performanceScore: 8650,
        payout: 0,
        reward: '+10% Boost',
      },
      {
        position: 5,
        creatureId: 'creature_ext_003',
        creatureName: 'Frost Weaver',
        rarity: 'epic',
        ownerId: 'user_004',
        ownerAddress: '0x5f2B...7e3C',
        performanceScore: 8400,
        payout: 0,
        reward: '+10% Boost',
      },
      {
        position: 6,
        creatureId: 'creature_ext_004',
        creatureName: 'Dark Specter',
        rarity: 'rare',
        ownerId: 'user_005',
        ownerAddress: '0x2b8A...1d5F',
        performanceScore: 7950,
        payout: 0,
        reward: '+10% Boost',
      },
      {
        position: 7,
        creatureId: 'creature_ext_005',
        creatureName: 'Neon Flash',
        rarity: 'uncommon',
        ownerId: 'user_006',
        ownerAddress: '0x7d5F...2c4A',
        performanceScore: 7200,
        payout: 0,
        reward: '+10% Boost',
      },
      {
        position: 8,
        creatureId: 'creature_ext_006',
        creatureName: 'Quick Silver',
        rarity: 'common',
        ownerId: 'user_007',
        ownerAddress: '0x4a2C...9b3E',
        performanceScore: 6800,
        payout: 0,
        reward: '+10% Boost',
      },
    ],
  },
  'race_past_002': {
    race: {
      id: 'race_past_002',
      name: 'Endurance Marathon',
      raceType: 'distance',
      entryFee: 100,
      maxEntries: 12,
      entryCount: 12,
      entryDeadline: '2026-02-02T14:00:00Z',
      status: 'resolved',
      totalEntrants: 12,
      totalPrizePool: 6000,
      completedAt: '2026-02-02T18:00:00Z',
    },
    entries: [
      {
        position: 1,
        creatureId: 'creature_ext_002',
        creatureName: 'Plasma Storm',
        rarity: 'mythic',
        ownerId: 'user_003',
        ownerAddress: '0x9d4E...2c1A',
        performanceScore: 10200,
        payout: 3500,
        reward: '+1 Action',
      },
      {
        position: 2,
        creatureId: 'creature_002',
        creatureName: 'Shadow Runner',
        rarity: 'epic',
        ownerId: 'user_001',
        ownerAddress: '0x7a3B...4f2E',
        performanceScore: 9800,
        payout: 1750,
        reward: '+50% Boost',
        breakdown: {
          effectiveStats: { speed: 80, stamina: 75, accel: 85, agility: 70, heart: 65, focus: 60 },
          weightedScore: 8100,
          fatigueMod: 920,
          sharpnessMod: 780,
          rngMod: 0,
          finalScore: 9800,
        },
      },
      {
        position: 3,
        creatureId: 'creature_ext_001',
        creatureName: 'Thunder Bolt',
        rarity: 'legendary',
        ownerId: 'user_002',
        ownerAddress: '0x3c1F...8a2D',
        performanceScore: 9450,
        payout: 750,
        reward: '+25% Boost',
      },
    ],
  },
};

/**
 * Fetch all available races
 * GET ${API_BASE}/races
 */
export function useRaces(): ApiResponse<Race[]> {
  const [data, setData] = useState<Race[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call
      // const response = await fetch(`${API_BASE}/races`);
      // const data = await response.json();

      await delay();
      setData(mockRaces);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch races'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Fetch results for a specific race
 * GET ${API_BASE}/races/${id}/results
 */
export function useRaceResults(raceId: string | null): ApiResponse<RaceResults> {
  const [data, setData] = useState<RaceResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!raceId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call
      // const response = await fetch(`${API_BASE}/races/${raceId}/results`);
      // const data = await response.json();

      await delay();
      const results = mockRaceResults[raceId];
      if (!results) {
        throw new Error('Race results not found');
      }
      setData(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch race results'));
    } finally {
      setLoading(false);
    }
  }, [raceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Enter a creature into a race
 * POST ${API_BASE}/races/${id}/enter
 */
export function useEnterRace(): MutationResponse<EnterRaceResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    raceId: string,
    creatureId: string,
    walletAddress: string
  ): Promise<EnterRaceResponse> => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call
      // const response = await fetch(`${API_BASE}/races/${raceId}/enter`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ creatureId, walletAddress }),
      // });
      // const data = await response.json();

      await delay(500);

      return {
        success: true,
        entryId: `entry_${Date.now()}`,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to enter race');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate: mutate as (...args: unknown[]) => Promise<EnterRaceResponse>, loading, error };
}
