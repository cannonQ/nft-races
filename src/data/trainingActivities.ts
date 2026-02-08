import { TrainingActivity } from '@/types/game';

/**
 * Static training activity definitions.
 * These don't come from the API - they're game constants.
 */
export const trainingActivities: TrainingActivity[] = [
  {
    id: 'train_sprint',
    name: 'Sprint Drills',
    icon: 'Zap',
    primaryStat: 'speed',
    secondaryStat: 'accel',
    primaryGain: 3,
    secondaryGain: 1,
    fatigueCost: 15,
    description: 'Intense bursts to maximize raw speed potential.',
  },
  {
    id: 'train_distance',
    name: 'Distance Runs',
    icon: 'Route',
    primaryStat: 'stamina',
    secondaryStat: 'heart',
    primaryGain: 3,
    secondaryGain: 2,
    fatigueCost: 20,
    description: 'Long-form cardio to build endurance and willpower.',
  },
  {
    id: 'train_agility',
    name: 'Agility Course',
    icon: 'Wind',
    primaryStat: 'agility',
    secondaryStat: 'accel',
    primaryGain: 3,
    secondaryGain: 1,
    fatigueCost: 18,
    description: 'Obstacle navigation for quick reflexes and nimble movement.',
  },
  {
    id: 'train_gate',
    name: 'Gate Work',
    icon: 'Timer',
    primaryStat: 'accel',
    secondaryStat: 'focus',
    primaryGain: 3,
    secondaryGain: 1,
    fatigueCost: 12,
    description: 'Start-line drills to perfect explosive launches.',
  },
  {
    id: 'train_cross',
    name: 'Cross-Training',
    icon: 'Dumbbell',
    primaryStat: 'stamina',
    secondaryStat: 'agility',
    primaryGain: 2,
    secondaryGain: 2,
    fatigueCost: 16,
    description: 'Varied exercises for balanced overall conditioning.',
  },
  {
    id: 'train_mental',
    name: 'Mental Prep',
    icon: 'Brain',
    primaryStat: 'focus',
    secondaryStat: 'heart',
    primaryGain: 3,
    secondaryGain: 2,
    fatigueCost: 8,
    description: 'Concentration exercises to sharpen mental fortitude.',
  },
];
