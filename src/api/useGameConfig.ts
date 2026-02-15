import { useState, useEffect, useCallback } from 'react';
import { ApiResponse } from '@/types/game';
import { API_BASE } from './config';

export interface ActivityConfig {
  primary: string;
  primary_gain: number;
  secondary: string;
  secondary_gain: number;
  fatigue_cost: number;
  sharpness_delta?: number;
}

export interface FatigueDecayTier {
  below: number;
  rate: number;
}

export interface GameConfig {
  activities: Record<string, ActivityConfig>;
  raceTypeWeights: Record<string, Record<string, number>>;
  prizeDistribution: number[];
  perStatCap?: number;
  totalStatCap?: number;
  baseActions?: number;
  cooldownHours?: number;
  // Sharpness modifier (race scoring)
  sharpnessModFloor?: number;
  sharpnessModCeiling?: number;
  // Sharpness decay
  sharpnessGraceHours?: number;
  sharpnessDecayPerDay?: number;
  // Fatigue decay tiers
  fatigueDecayTiers?: FatigueDecayTier[];
  // Treatments
  treatments?: Record<string, import('@/types/game').TreatmentDef>;
  // Fees
  requireFees?: boolean;
  treasuryErgoTree?: string;
  trainingFeeNanoerg?: number;
}

/**
 * Fetch public game configuration (activity definitions, race type weights).
 * Optionally pass collectionId for collection-specific overrides.
 * GET ${API_BASE}/config?collectionId=...
 */
export function useGameConfig(collectionId?: string): ApiResponse<GameConfig> {
  const [data, setData] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = collectionId
        ? `${API_BASE}/config?collectionId=${collectionId}`
        : `${API_BASE}/config`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const config = await response.json();
      setData(config);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch game config'));
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
