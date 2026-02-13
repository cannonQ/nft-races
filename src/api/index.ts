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

// Game Config
export { useGameConfig } from './useGameConfig';

// Wallet Ledger
export { useWalletLedger } from './useWalletLedger';

// Wallet Profile (display name)
export { useWalletProfile, useUpdateWalletProfile } from './useWalletProfile';

// Race History (creature profile)
export { useRaceHistory } from './useRaceHistory';

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
  LedgerEntry,
  WalletLedger,
  WalletProfile,
  CreatureSpending,
  ApiResponse,
  MutationResponse,
} from '@/types/game';
