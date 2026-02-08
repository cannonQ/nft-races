import { useState, useEffect, useCallback } from 'react';
import { LeaderboardEntry, ApiResponse } from '@/types/game';
import { API_BASE, delay } from './config';

// Mock leaderboard data
const mockLeaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    creatureId: 'creature_003',
    creatureName: 'Neon Phantom',
    tokenId: '3456',
    rarity: 'legendary',
    ownerAddress: '0x7a3B...4f2E',
    wins: 18,
    places: 15,
    shows: 12,
    racesEntered: 52,
    earnings: 8500,
  },
  {
    rank: 2,
    creatureId: 'creature_ext_003',
    creatureName: 'Cyber Wolf',
    tokenId: '7890',
    rarity: 'mythic',
    ownerAddress: '0xABCD...EF01',
    wins: 15,
    places: 18,
    shows: 10,
    racesEntered: 48,
    earnings: 7200,
  },
  {
    rank: 3,
    creatureId: 'creature_002',
    creatureName: 'Shadow Runner',
    tokenId: '2345',
    rarity: 'epic',
    ownerAddress: '0x7a3B...4f2E',
    wins: 6,
    places: 12,
    shows: 9,
    racesEntered: 38,
    earnings: 4800,
  },
  {
    rank: 4,
    creatureId: 'creature_ext_004',
    creatureName: 'Plasma Surge',
    tokenId: '1122',
    rarity: 'epic',
    ownerAddress: '0x9876...5432',
    wins: 8,
    places: 10,
    shows: 14,
    racesEntered: 42,
    earnings: 4200,
  },
  {
    rank: 5,
    creatureId: 'creature_001',
    creatureName: 'Volt Striker',
    tokenId: '1234',
    rarity: 'rare',
    ownerAddress: '0x7a3B...4f2E',
    wins: 6,
    places: 12,
    shows: 9,
    racesEntered: 24,
    earnings: 3600,
  },
  {
    rank: 6,
    creatureId: 'creature_ext_005',
    creatureName: 'Digital Demon',
    tokenId: '3344',
    rarity: 'rare',
    ownerAddress: '0xFEDC...BA98',
    wins: 5,
    places: 8,
    shows: 12,
    racesEntered: 35,
    earnings: 2800,
  },
  {
    rank: 7,
    creatureId: 'creature_ext_006',
    creatureName: 'Quantum Racer',
    tokenId: '5566',
    rarity: 'uncommon',
    ownerAddress: '0x1111...2222',
    wins: 4,
    places: 9,
    shows: 11,
    racesEntered: 30,
    earnings: 2400,
  },
  {
    rank: 8,
    creatureId: 'creature_ext_007',
    creatureName: 'Byte Runner',
    tokenId: '7788',
    rarity: 'uncommon',
    ownerAddress: '0x3333...4444',
    wins: 3,
    places: 7,
    shows: 8,
    racesEntered: 25,
    earnings: 1800,
  },
  {
    rank: 9,
    creatureId: 'creature_004',
    creatureName: 'Circuit Breaker',
    tokenId: '4567',
    rarity: 'uncommon',
    ownerAddress: '0x7a3B...4f2E',
    wins: 1,
    places: 2,
    shows: 3,
    racesEntered: 8,
    earnings: 600,
  },
  {
    rank: 10,
    creatureId: 'creature_ext_008',
    creatureName: 'Pixel Phantom',
    tokenId: '9900',
    rarity: 'common',
    ownerAddress: '0x5555...6666',
    wins: 1,
    places: 3,
    shows: 5,
    racesEntered: 15,
    earnings: 500,
  },
];

/**
 * Fetch leaderboard, optionally filtered by season
 * GET ${API_BASE}/leaderboard?season=${seasonId}
 */
export function useLeaderboard(seasonId?: string): ApiResponse<LeaderboardEntry[]> {
  const [data, setData] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call
      // const url = seasonId 
      //   ? `${API_BASE}/leaderboard?season=${seasonId}`
      //   : `${API_BASE}/leaderboard`;
      // const response = await fetch(url);
      // const data = await response.json();

      await delay();
      setData(mockLeaderboard);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch leaderboard'));
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
