// API Hooks - Barrel Export
// All hooks return { data, loading, error, refetch }
// Mutation hooks return { mutate, loading, error }

export { API_BASE } from './config';

// Season
export { useCurrentSeason } from './useCurrentSeason';

// Creatures
export { 
  useCreaturesByWallet, 
  useCreature, 
  useRegisterCreature 
} from './useCreatures';

// Training
export { 
  useTrainingLog, 
  useTrain 
} from './useTraining';

// Races
export { 
  useRaces, 
  useRaceResults, 
  useEnterRace 
} from './useRaces';

// Leaderboard
export { useLeaderboard } from './useLeaderboard';

// Re-export types for convenience
export type {
  StatBlock,
  CreatureWithStats,
  Activity,
  RaceType,
  RaceStatus,
  Race,
  RaceEntry,
  RaceResults,
  TrainingLogEntry,
  TrainResponse,
  Season,
  LeaderboardEntry,
  EnterRaceResponse,
  RegisterCreatureResponse,
  ApiResponse,
  MutationResponse,
} from '@/types/game';
