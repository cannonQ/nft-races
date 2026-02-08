import { useState, useEffect, useCallback } from 'react';
import { CreatureWithStats, ApiResponse, RegisterCreatureResponse, MutationResponse } from '@/types/game';
import { API_BASE, delay } from './config';

// Mock creatures data
const mockCreatures: CreatureWithStats[] = [
  {
    id: 'creature_001',
    name: 'Volt Striker',
    rarity: 'rare',
    tokenId: '1234',
    collectionId: 'genesis',
    ownerAddress: '0x7a3B...4f2E',
    baseStats: { speed: 75, stamina: 60, accel: 70, agility: 65, heart: 55, focus: 50 },
    trainedStats: { speed: 12, stamina: 8, accel: 5, agility: 10, heart: 3, focus: 7 },
    totalTrained: 45,
    fatigue: 35,
    sharpness: 72,
    bonusActions: 1,
    boostMultiplier: 0.50,
    actionsRemaining: 3,
    maxActionsToday: 3,
    cooldownEndsAt: null,
    lastActionAt: '2026-02-07T10:30:00Z',
    lastRaceAt: '2026-02-06T18:00:00Z',
    actionCount: 127,
    raceCount: 24,
    totalRaces: 24,
    totalEarnings: 3600,
    prestige: {
      tier: 2,
      lifetimeWins: 6,
      lifetimePlaces: 12,
      lifetimeShows: 9,
      lifetimeRaces: 24,
      badges: ['first_win', 'speed_demon'],
    },
  },
  {
    id: 'creature_002',
    name: 'Shadow Runner',
    rarity: 'epic',
    tokenId: '2345',
    collectionId: 'genesis',
    ownerAddress: '0x7a3B...4f2E',
    baseStats: { speed: 80, stamina: 75, accel: 85, agility: 70, heart: 65, focus: 60 },
    trainedStats: { speed: 18, stamina: 15, accel: 12, agility: 14, heart: 8, focus: 10 },
    totalTrained: 77,
    fatigue: 15,
    sharpness: 88,
    bonusActions: 0,
    boostMultiplier: 0.25,
    actionsRemaining: 2,
    maxActionsToday: 2,
    cooldownEndsAt: null,
    lastActionAt: '2026-02-07T08:00:00Z',
    lastRaceAt: '2026-02-05T20:00:00Z',
    actionCount: 203,
    raceCount: 38,
    totalRaces: 38,
    totalEarnings: 4800,
    prestige: {
      tier: 1,
      lifetimeWins: 6,
      lifetimePlaces: 12,
      lifetimeShows: 9,
      lifetimeRaces: 38,
      badges: ['first_win', 'marathon_master'],
    },
  },
  {
    id: 'creature_003',
    name: 'Neon Phantom',
    rarity: 'legendary',
    tokenId: '3456',
    collectionId: 'genesis',
    ownerAddress: '0x7a3B...4f2E',
    baseStats: { speed: 90, stamina: 85, accel: 88, agility: 82, heart: 78, focus: 75 },
    trainedStats: { speed: 25, stamina: 20, accel: 22, agility: 18, heart: 15, focus: 12 },
    totalTrained: 112,
    fatigue: 45,
    sharpness: 65,
    bonusActions: 0,
    boostMultiplier: 0,
    actionsRemaining: 2,
    maxActionsToday: 2,
    cooldownEndsAt: '2026-02-07T16:00:00Z',
    lastActionAt: '2026-02-07T12:00:00Z',
    lastRaceAt: '2026-02-07T14:00:00Z',
    actionCount: 312,
    raceCount: 52,
    totalRaces: 52,
    totalEarnings: 8500,
    prestige: {
      tier: 3,
      lifetimeWins: 18,
      lifetimePlaces: 15,
      lifetimeShows: 12,
      lifetimeRaces: 52,
      badges: ['first_win', 'speed_demon', 'marathon_master', 'legend'],
    },
  },
  {
    id: 'creature_004',
    name: 'Circuit Breaker',
    rarity: 'uncommon',
    tokenId: '4567',
    collectionId: 'genesis',
    ownerAddress: '0x7a3B...4f2E',
    baseStats: { speed: 55, stamina: 50, accel: 60, agility: 58, heart: 45, focus: 40 },
    trainedStats: { speed: 5, stamina: 3, accel: 4, agility: 6, heart: 2, focus: 3 },
    totalTrained: 23,
    fatigue: 85,
    sharpness: 40,
    bonusActions: 0,
    boostMultiplier: 0.10,
    actionsRemaining: 0,
    maxActionsToday: 2,
    cooldownEndsAt: '2026-02-08T00:00:00Z',
    lastActionAt: '2026-02-07T14:00:00Z',
    lastRaceAt: '2026-02-07T16:00:00Z',
    actionCount: 45,
    raceCount: 8,
    totalRaces: 8,
    totalEarnings: 600,
    prestige: {
      tier: 0,
      lifetimeWins: 1,
      lifetimePlaces: 2,
      lifetimeShows: 3,
      lifetimeRaces: 8,
      badges: ['first_win'],
    },
  },
];

/**
 * Fetch all creatures owned by a wallet
 * GET ${API_BASE}/creatures/by-wallet/${address}
 */
export function useCreaturesByWallet(walletAddress: string | null): ApiResponse<CreatureWithStats[]> {
  const [data, setData] = useState<CreatureWithStats[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!walletAddress) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call
      // const response = await fetch(`${API_BASE}/creatures/by-wallet/${walletAddress}`);
      // const data = await response.json();

      await delay();
      setData(mockCreatures);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch creatures'));
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Fetch a single creature by ID
 * GET ${API_BASE}/creatures/${id}
 */
export function useCreature(creatureId: string | null): ApiResponse<CreatureWithStats> {
  const [data, setData] = useState<CreatureWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!creatureId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call
      // const response = await fetch(`${API_BASE}/creatures/${creatureId}`);
      // const data = await response.json();

      await delay();
      const creature = mockCreatures.find(c => c.id === creatureId);
      if (!creature) {
        throw new Error('Creature not found');
      }
      setData(creature);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch creature'));
    } finally {
      setLoading(false);
    }
  }, [creatureId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Register a new creature from NFT
 * POST ${API_BASE}/creatures/register
 */
export function useRegisterCreature(): MutationResponse<RegisterCreatureResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (tokenId: string, walletAddress: string): Promise<RegisterCreatureResponse> => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call
      // const response = await fetch(`${API_BASE}/creatures/register`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ tokenId, walletAddress }),
      // });
      // const data = await response.json();

      await delay();
      
      // Mock new creature registration
      const newCreature: CreatureWithStats = {
        id: `creature_${Date.now()}`,
        name: `New Creature #${tokenId}`,
        rarity: 'common',
        tokenId,
        collectionId: 'genesis',
        ownerAddress: walletAddress,
        baseStats: { speed: 50, stamina: 50, accel: 50, agility: 50, heart: 50, focus: 50 },
        trainedStats: { speed: 0, stamina: 0, accel: 0, agility: 0, heart: 0, focus: 0 },
        totalTrained: 0,
        fatigue: 0,
        sharpness: 50,
        bonusActions: 0,
        boostMultiplier: 0,
        actionsRemaining: 2,
        maxActionsToday: 2,
        cooldownEndsAt: null,
        lastActionAt: null,
        lastRaceAt: null,
        actionCount: 0,
        raceCount: 0,
        totalRaces: 0,
        totalEarnings: 0,
        prestige: {
          tier: 0,
          lifetimeWins: 0,
          lifetimePlaces: 0,
          lifetimeShows: 0,
          lifetimeRaces: 0,
          badges: [],
        },
      };

      return { success: true, creature: newCreature };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to register creature');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate: mutate as (...args: unknown[]) => Promise<RegisterCreatureResponse>, loading, error };
}
