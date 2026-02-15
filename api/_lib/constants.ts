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

/** Convert nanoERG to ERG */
export function nanoErgToErg(nanoErg: number): number {
  return nanoErg / 1_000_000_000;
}
