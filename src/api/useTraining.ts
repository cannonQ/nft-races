import { useState, useEffect, useCallback } from 'react';
import { TrainingLogEntry, TrainResponse, Activity, StatBlock, ApiResponse, MutationResponse } from '@/types/game';
import { API_BASE, delay } from './config';

// Mock training logs
const mockTrainingLogs: Record<string, TrainingLogEntry[]> = {
  'creature_001': [
    {
      id: 'log_001',
      activity: 'sprint_drills',
      activityName: 'Sprint Drills',
      activityIcon: 'Zap',
      primaryStat: 'speed',
      statChanges: { speed: 3 },
      fatigueDelta: 15,
      wasBoosted: false,
      createdAt: '2026-02-07T10:30:00Z',
    },
    {
      id: 'log_002',
      activity: 'gate_work',
      activityName: 'Gate Work',
      activityIcon: 'Timer',
      primaryStat: 'accel',
      statChanges: { accel: 3 },
      fatigueDelta: 12,
      wasBoosted: true,
      createdAt: '2026-02-07T08:00:00Z',
    },
    {
      id: 'log_003',
      activity: 'agility_course',
      activityName: 'Agility Course',
      activityIcon: 'Wind',
      primaryStat: 'agility',
      statChanges: { agility: 2, speed: 1 },
      fatigueDelta: 18,
      wasBoosted: false,
      createdAt: '2026-02-06T14:00:00Z',
    },
  ],
  'creature_002': [
    {
      id: 'log_004',
      activity: 'distance_runs',
      activityName: 'Distance Runs',
      activityIcon: 'Route',
      primaryStat: 'stamina',
      statChanges: { stamina: 3 },
      fatigueDelta: 20,
      wasBoosted: false,
      createdAt: '2026-02-07T08:00:00Z',
    },
    {
      id: 'log_005',
      activity: 'mental_prep',
      activityName: 'Mental Prep',
      activityIcon: 'Brain',
      primaryStat: 'focus',
      statChanges: { focus: 2, heart: 1 },
      fatigueDelta: 8,
      wasBoosted: false,
      createdAt: '2026-02-06T16:00:00Z',
    },
  ],
  'creature_003': [
    {
      id: 'log_006',
      activity: 'sprint_drills',
      activityName: 'Sprint Drills',
      activityIcon: 'Zap',
      primaryStat: 'speed',
      statChanges: { speed: 5 },
      fatigueDelta: 15,
      wasBoosted: true,
      createdAt: '2026-02-07T12:00:00Z',
    },
    {
      id: 'log_007',
      activity: 'cross_training',
      activityName: 'Cross-Training',
      activityIcon: 'Dumbbell',
      primaryStat: 'stamina',
      statChanges: { stamina: 2, agility: 1 },
      fatigueDelta: 14,
      wasBoosted: false,
      createdAt: '2026-02-06T10:00:00Z',
    },
  ],
  'creature_004': [
    {
      id: 'log_008',
      activity: 'gate_work',
      activityName: 'Gate Work',
      activityIcon: 'Timer',
      primaryStat: 'accel',
      statChanges: { accel: 2 },
      fatigueDelta: 12,
      wasBoosted: false,
      createdAt: '2026-02-07T14:00:00Z',
    },
  ],
};

/**
 * Fetch training log for a creature
 * GET ${API_BASE}/creatures/${id}/training-log
 */
export function useTrainingLog(creatureId: string | null): ApiResponse<TrainingLogEntry[]> {
  const [data, setData] = useState<TrainingLogEntry[] | null>(null);
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
      // const response = await fetch(`${API_BASE}/creatures/${creatureId}/training-log`);
      // const data = await response.json();

      await delay();
      setData(mockTrainingLogs[creatureId] || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch training log'));
    } finally {
      setLoading(false);
    }
  }, [creatureId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Activity stat effects for mock training
const activityEffects: Record<Activity, { primary: keyof StatBlock; secondary?: keyof StatBlock; fatigue: number }> = {
  'sprint_drills': { primary: 'speed', fatigue: 15 },
  'distance_runs': { primary: 'stamina', fatigue: 20 },
  'agility_course': { primary: 'agility', secondary: 'speed', fatigue: 18 },
  'gate_work': { primary: 'accel', fatigue: 12 },
  'cross_training': { primary: 'stamina', secondary: 'agility', fatigue: 14 },
  'mental_prep': { primary: 'focus', secondary: 'heart', fatigue: 8 },
};

/**
 * Execute a training action
 * POST ${API_BASE}/train
 */
export function useTrain(): MutationResponse<TrainResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    creatureId: string, 
    activity: Activity, 
    walletAddress: string
  ): Promise<TrainResponse> => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call
      // const response = await fetch(`${API_BASE}/train`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ creatureId, activity, walletAddress }),
      // });
      // const data = await response.json();

      await delay(500); // Slightly longer delay for training action

      const effects = activityEffects[activity];
      const baseGain = 3;
      const boostMultiplier = 0.5; // Mock: assume 50% boost was active
      const boostedGain = Math.round(baseGain * (1 + boostMultiplier));

      const statChanges: Partial<StatBlock> = {
        [effects.primary]: boostedGain,
      };
      if (effects.secondary) {
        statChanges[effects.secondary] = Math.round(boostedGain * 0.5);
      }

      // Mock new stats (would come from backend)
      const newStats: StatBlock = {
        speed: 87 + (statChanges.speed || 0),
        stamina: 68 + (statChanges.stamina || 0),
        accel: 75 + (statChanges.accel || 0),
        agility: 75 + (statChanges.agility || 0),
        heart: 58 + (statChanges.heart || 0),
        focus: 57 + (statChanges.focus || 0),
      };

      return {
        success: true,
        statChanges,
        newStats,
        fatigue: 50, // New fatigue level
        sharpness: 68, // New sharpness
        boostUsed: true,
        actionsRemaining: 2,
        nextActionAt: null,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Training failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate: mutate as (...args: unknown[]) => Promise<TrainResponse>, loading, error };
}
