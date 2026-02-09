import { TrainingActivity } from '@/types/game';

/**
 * Static training activity definitions.
 * These don't come from the API - they're game constants.
 */
export const trainingActivities: TrainingActivity[] = [
  {
    id: 'sprint_drills',
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
    id: 'distance_runs',
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
    id: 'agility_course',
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
    id: 'gate_work',
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
    id: 'cross_training',
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
    id: 'mental_prep',
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
