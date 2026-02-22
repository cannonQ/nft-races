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

// Rarity tiers for creatures (string — each collection defines its own tiers)
export type Rarity = string;

// Rarity class for class-restricted races
export type RarityClass = 'rookie' | 'contender' | 'champion';

// CyberPets fallback — not the canonical source for multi-collection
export const CLASS_RARITIES_DEFAULT: Record<RarityClass, string[]> = {
  rookie: ['common', 'uncommon', 'rare'],
  contender: ['masterwork', 'epic', 'relic'],
  champion: ['legendary', 'mythic', 'cyberium'],
};

/** @deprecated Use getClassRarities(config) for per-collection support */
export const CLASS_RARITIES = CLASS_RARITIES_DEFAULT;

/**
 * Get class rarities from a game config object (per-collection).
 * Falls back to CyberPets default if config doesn't contain class_rarities.
 */
export function getClassRarities(
  config: Record<string, any> | null | undefined
): Record<RarityClass, string[]> {
  const cr = config?.class_rarities;
  if (cr && cr.rookie && cr.contender && cr.champion) {
    return cr as Record<RarityClass, string[]>;
  }
  return CLASS_RARITIES_DEFAULT;
}

export const CLASS_LABELS: Record<RarityClass, string> = {
  rookie: 'Rookie',
  contender: 'Contender',
  champion: 'Champion',
};

// Discrete boost reward (UTXO-style, awarded from races)
export interface BoostReward {
  id: string;
  multiplier: number;
  awardedAtHeight: number;
  expiresAtHeight: number;
  raceId: string | null;
}

// Discrete recovery reward (UTXO-style, awarded from class races)
export interface RecoveryReward {
  id: string;
  fatigueReduction: number;
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
  recoveries: RecoveryReward[];
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
  // Treatment lockout state (null = not in treatment)
  treatment: {
    type: string;
    startedAt: string;
    endsAt: string;
  } | null;
  // Convenience fields matching old Creature interface
  totalRaces: number;
  totalEarnings: number;
  imageUrl?: string;
  fallbackImageUrl?: string;
}

// Treatment tier definition (from game_config)
export interface TreatmentDef {
  name: string;
  duration_hours: number;
  fatigue_reduction: number | null;  // null = reset to 0
  sharpness_set: number | null;      // null = unchanged
  cost_nanoerg: number;
}

// Treatment start response
export interface TreatmentStartResponse {
  success: boolean;
  treatmentType: string;
  treatmentName: string;
  durationHours: number;
  endsAt: string;
  costNanoerg: number;
}

// Training activity types
export type Activity =
  | 'sprint_drills'
  | 'distance_runs'
  | 'agility_course'
  | 'gate_work'
  | 'cross_training'
  | 'mental_prep'
  | 'meditation';

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
  sharpnessDelta: number;
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
  entryFeeToken?: number | null;
  maxEntries: number;
  entryCount: number;
  entryDeadline: string;
  status: RaceStatus;
  autoResolve?: boolean;
  rarityClass?: RarityClass | null;
  classWeight?: number;
  collectionId?: string;
  collectionName?: string;
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
  ownerDisplayName: string | null;
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
  recoveriesConsumed: string[];
  recoveryApplied: number;
  actionsRemaining: number;
  nextActionAt: string | null;
}

// Batch training input (per creature)
export interface BatchTrainCreatureInput {
  creatureId: string;
  activity: string;
  boostRewardIds?: string[];
  recoveryRewardIds?: string[];
}

// Batch training mutation response
export interface BatchTrainResponse {
  success: boolean;
  partial?: boolean;
  results: Array<{ creatureId: string; result: TrainResponse }>;
  errors?: Array<{ creatureId: string; error: string }>;
}

// Season data
export interface Season {
  id: string;
  name: string;
  seasonNumber: number;
  collectionId?: string;
  collectionName?: string;
  modifier: {
    theme: string;
    description: string;
  };
  startDate: string;
  endDate: string;
  prizePool: number;
  prizePoolToken?: number | null;
  prizePoolTokenName?: string | null;
  status: 'upcoming' | 'active' | 'completed';
}

// Collection info
export interface Collection {
  id: string;
  name: string;
}

// Fee token config (from collection's game_config_overrides)
export interface FeeToken {
  token_id: string;
  name: string;
  decimals: number;
  training_fee: number;
  default_race_entry_fee: number;
  treatment_fees: Record<string, number>;
}

// Babel config
export interface BabelConfig {
  enabled: boolean;
}

// Payment currency choice
export type PaymentCurrency = 'erg' | 'token';

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  creatureId: string;
  creatureName: string;
  tokenId: string;
  rarity: Rarity;
  imageUrl?: string;
  fallbackImageUrl?: string;
  ownerAddress: string;
  ownerDisplayName: string | null;
  wins: number;
  places: number;
  shows: number;
  racesEntered: number;
  leaguePoints: number;
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

// Batch race entry mutation response
export interface EnterRaceBatchResponse {
  success: boolean;
  partial?: boolean;
  entries: Array<{ creatureId: string; entryId: string }>;
  errors?: Array<{ creatureId: string; error: string }>;
}

// Register creature mutation response
export interface RegisterCreatureResponse {
  success: boolean;
  creature: CreatureWithStats;
}

// Credit ledger entry (shadow billing)
export interface LedgerEntry {
  id: string;
  txType: string;
  amountNanoerg: number;
  amountErg: number;
  balanceAfterNanoerg: number;
  creatureId: string | null;
  creatureName: string | null;
  creatureImageUrl: string | null;
  creatureFallbackImageUrl: string | null;
  raceId: string | null;
  raceName: string | null;
  seasonId: string | null;
  seasonName: string | null;
  collectionId: string | null;
  collectionName: string | null;
  memo: string | null;
  txId: string | null;
  shadow: boolean;
  feeTokenId: string | null;
  feeTokenAmount: number | null;
  feeTokenName: string | null;
  createdAt: string;
}

// Per-creature spending breakdown
export interface CreatureSpending {
  creatureId: string;
  spentNanoerg: number;
  spentErg: number;
}

// Per-collection prize pool
export interface CollectionPrizePool {
  collectionId: string;
  collectionName: string;
  prizePoolNanoerg: number;
  prizePoolErg: number;
}

// Per-season payout summary for a wallet
export interface SeasonPayoutSeason {
  seasonId: string;
  seasonName: string;
  collectionName: string | null;
  startDate: string | null;
  endDate: string | null;
  prizePoolErg: number;
  yourTotalErg: number;
  yourWinsErg: number;
  yourPlacesErg: number;
  yourShowsErg: number;
}

// Season payout breakdown per creature (wallet ledger summary)
export interface SeasonPayoutCreature {
  seasonId: string;
  seasonName: string;
  creatureId: string;
  creatureName: string;
  creatureImageUrl: string | null;
  creatureFallbackImageUrl: string | null;
  wins: number;
  places: number;
  shows: number;
  winsErg: number;
  placesErg: number;
  showsErg: number;
  totalErg: number;
}

// Season payouts summary for a wallet
export interface SeasonPayoutsSummary {
  totalEarnedNanoerg: number;
  totalEarnedErg: number;
  seasons: SeasonPayoutSeason[];
  byCreature: SeasonPayoutCreature[];
}

// Wallet ledger summary
export interface WalletLedger {
  balance: number;
  balanceErg: number;
  totalSpent: number;
  totalSpentErg: number;
  totalEarned: number;
  totalEarnedErg: number;
  seasonPrizePoolNanoerg: number;
  seasonPrizePoolErg: number;
  prizePools: CollectionPrizePool[];
  trainingCount: number;
  racesEntered: number;
  creatureSpending: CreatureSpending[];
  seasonPayouts: SeasonPayoutsSummary;
  entries: LedgerEntry[];
}

// Wallet profile (display name)
export interface WalletProfile {
  address: string;
  displayName: string | null;
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
