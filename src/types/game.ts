// Core stat block used throughout the game
export interface StatBlock {
  speed: number;
  stamina: number;
  accel: number;
  agility: number;
  heart: number;
  focus: number;
}

// Stat type key for type-safe stat access
export type StatType = keyof StatBlock;

// Rarity tiers for creatures
export type Rarity = 'common' | 'uncommon' | 'rare' | 'masterwork' | 'epic' | 'relic' | 'legendary' | 'mythic' | 'cyberium';

// Discrete boost reward (UTXO-style, awarded from races)
export interface BoostReward {
  id: string;
  multiplier: number;
  awardedAtHeight: number;
  expiresAtHeight: number;
  raceId: string | null;
}

// Full creature object with all stats and metadata
export interface CreatureWithStats {
  id: string;
  name: string;
  rarity: Rarity;
  tokenId: string;
  collectionId: string;
  ownerAddress: string;
  baseStats: StatBlock;
  trainedStats: StatBlock;
  totalTrained: number;
  fatigue: number;
  sharpness: number;
  bonusActions: number;
  boosts: BoostReward[];
  boostMultiplier: number; // computed sum of available boosts
  actionsRemaining: number;
  maxActionsToday: number;
  cooldownEndsAt: string | null;
  lastActionAt: string | null;
  lastRaceAt: string | null;
  actionCount: number;
  raceCount: number;
  prestige: {
    tier: number;
    lifetimeWins: number;
    lifetimePlaces: number;
    lifetimeShows: number;
    lifetimeRaces: number;
    badges: string[];
  };
  // Convenience fields matching old Creature interface
  totalRaces: number;
  totalEarnings: number;
  imageUrl?: string;
}

// Training activity types
export type Activity = 
  | 'sprint_drills' 
  | 'distance_runs' 
  | 'agility_course' 
  | 'gate_work' 
  | 'cross_training' 
  | 'mental_prep';

// Training activity configuration
export interface TrainingActivity {
  id: string;
  name: string;
  icon: string;
  primaryStat: StatType;
  secondaryStat: StatType | null;
  primaryGain: number;
  secondaryGain: number;
  fatigueCost: number;
  description: string;
}

// Race type categories
export type RaceType = 'sprint' | 'distance' | 'technical' | 'mixed' | 'hazard';

// Race status lifecycle
export type RaceStatus = 'upcoming' | 'open' | 'running' | 'locked' | 'resolved' | 'cancelled';

// Race listing
export interface Race {
  id: string;
  name: string;
  raceType: RaceType;
  entryFee: number;
  maxEntries: number;
  entryCount: number;
  entryDeadline: string;
  status: RaceStatus;
  autoResolve?: boolean;
}

// Score breakdown for race results
export interface ScoreBreakdown {
  effectiveStats: StatBlock;
  raceTypeWeights: StatBlock;
  weightedScore: number;
  fatigue: number;
  sharpness: number;
  fatigueMod: number;
  sharpnessMod: number;
  rngMod: number;
  finalScore: number;
}

// Individual race entry/result
export interface RaceEntry {
  position: number;
  creatureId: string;
  creatureName: string;
  rarity: Rarity;
  ownerId: string;
  ownerAddress: string;
  performanceScore: number;
  payout: number;
  reward: string; // "+1 Action" | "+50% Boost" | "+25% Boost" | "+10% Boost"
  breakdown?: ScoreBreakdown;
}

// Full race results response
export interface RaceResults {
  race: Race & {
    totalEntrants: number;
    totalPrizePool: number;
    completedAt: string;
    blockHash: string | null;
  };
  entries: RaceEntry[];
}

// Training log entry
export interface TrainingLogEntry {
  id: string;
  activity: Activity;
  activityName: string;
  activityIcon: string;
  primaryStat: StatType;
  statChanges: Partial<StatBlock>;
  fatigueDelta: number;
  wasBoosted: boolean;
  createdAt: string;
}

// Training mutation response
export interface TrainResponse {
  success: boolean;
  statChanges: Partial<StatBlock>;
  newStats: StatBlock;
  fatigue: number;
  sharpness: number;
  boostUsed: boolean;
  totalBoostMultiplier: number;
  boostsConsumed: string[];
  actionsRemaining: number;
  nextActionAt: string | null;
}

// Season data
export interface Season {
  id: string;
  name: string;
  seasonNumber: number;
  modifier: { 
    theme: string; 
    description: string; 
  };
  startDate: string;
  endDate: string;
  prizePool: number;
  status: 'upcoming' | 'active' | 'completed';
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  creatureId: string;
  creatureName: string;
  tokenId: string;
  rarity: Rarity;
  imageUrl?: string;
  ownerAddress: string;
  wins: number;
  places: number;
  shows: number;
  racesEntered: number;
  avgScore: number;
  earnings: number;
}

// Past race summary for leaderboard
export interface PastRace {
  id: string;
  name: string;
  raceType: RaceType;
  completedAt: string;
  yourPosition?: number;
}

// Race entry mutation response
export interface EnterRaceResponse {
  success: boolean;
  entryId: string;
}

// Register creature mutation response
export interface RegisterCreatureResponse {
  success: boolean;
  creature: CreatureWithStats;
}

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Mutation hook response
export interface MutationResponse<T> {
  mutate: (...args: unknown[]) => Promise<T>;
  loading: boolean;
  error: Error | null;
}
