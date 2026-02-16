/** Activity display metadata, sourced from src/data/trainingActivities.ts */
export const ACTIVITY_DISPLAY: Record<string, { name: string; icon: string; primaryStat: string }> = {
  sprint_drills:  { name: 'Sprint Drills',  icon: 'Zap',      primaryStat: 'speed' },
  distance_runs:  { name: 'Distance Runs',  icon: 'Route',    primaryStat: 'stamina' },
  agility_course: { name: 'Agility Course', icon: 'Wind',     primaryStat: 'agility' },
  gate_work:      { name: 'Gate Work',      icon: 'Timer',    primaryStat: 'accel' },
  cross_training: { name: 'Cross-Training', icon: 'Dumbbell', primaryStat: 'stamina' },
  mental_prep:    { name: 'Mental Prep',    icon: 'Brain',    primaryStat: 'focus' },
  meditation:     { name: 'Meditation',    icon: 'Leaf',     primaryStat: 'focus' },
};

/** Map race finish position to a human-readable reward label */
export function positionToRewardLabel(position: number): string {
  if (position === 1) return '+1 Action';
  if (position === 2) return '+50% Boost';
  if (position === 3) return '+25% Boost';
  return '+10% Boost';
}

/** Training cost in nanoERG (0.01 ERG) */
export const TRAINING_FEE_NANOERG = 10_000_000;

/** Treasury address receiving fee payments */
export const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || '';

/** ErgoTree of the treasury address (hex-encoded, used by frontend TX building) */
export const TREASURY_ERGO_TREE = process.env.TREASURY_ERGO_TREE || '';

/** When true, real ERG payments are required for training/race entry */
export const REQUIRE_FEES = process.env.REQUIRE_FEES === 'true';

/** Rarity class definitions — maps class name to allowed rarity tiers */
export type RarityClass = 'rookie' | 'contender' | 'champion';

export const CLASS_RARITIES: Record<RarityClass, string[]> = {
  rookie: ['common', 'uncommon', 'rare'],
  contender: ['masterwork', 'epic', 'relic'],
  champion: ['legendary', 'mythic', 'cyberium'],
};

export const CLASS_LABELS: Record<RarityClass, string> = {
  rookie: 'Rookie',
  contender: 'Contender',
  champion: 'Champion',
};

/** Default class weight for class-restricted races (1/7 of Open race points) */
export const DEFAULT_CLASS_WEIGHT = 1 / 7;

/** League points awarded per position (Open race at full weight) */
export const LEAGUE_POINTS_BY_POSITION = [7, 5, 3, 1]; // 1st, 2nd, 3rd, 4th+

/** Recovery fatigue reduction per position in class races */
export const RECOVERY_BY_POSITION = [8, 5, 4, 3]; // 1st, 2nd, 3rd, 4th+

/** Recovery reward expiry in blocks (~3 days at ~2 min/block) */
export const RECOVERY_EXPIRY_BLOCKS = 2160;

/** Convert nanoERG to ERG */
export function nanoErgToErg(nanoErg: number): number {
  return nanoErg / 1_000_000_000;
}
