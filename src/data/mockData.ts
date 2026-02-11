// Mock Data Layer for NFT Racing Training System
// All data structures match expected API response shapes

export type Rarity = 'common' | 'uncommon' | 'rare' | 'masterwork' | 'epic' | 'relic' | 'legendary' | 'mythic' | 'cyberium';

export type RaceType = 'sprint' | 'distance' | 'technical' | 'mixed' | 'hazard';

export type StatType = 'speed' | 'stamina' | 'acceleration' | 'agility' | 'heart' | 'focus';

export interface CreatureStats {
  speed: number;
  stamina: number;
  acceleration: number;
  agility: number;
  heart: number;
  focus: number;
}

export interface Creature {
  id: string;
  name: string;
  rarity: Rarity;
  imageUrl?: string;
  baseStats: CreatureStats;
  trainedStats: CreatureStats;
  fatigue: number; // 0-100
  sharpness: number; // 0-100
  cooldownEndsAt: Date | null;
  prestigeTier: number;
  lifetimeWins: number;
  lifetimePlaces: number;
  lifetimeShows: number;
  totalRaces: number;
  totalEarnings: number;
  ownerId: string;
  // Race reward fields
  bonusActions: number; // Extra training actions from race wins
  boostMultiplier: number; // Training boost from race placement (0.10, 0.25, 0.50)
  actionsRemaining: number; // Actions left today
  maxActionsToday: number; // Max actions including bonus
}

export interface Season {
  id: string;
  name: string;
  modifier: string;
  startDate: Date;
  endDate: Date;
  prizePool: {
    win: number;
    place: number;
    show: number;
    total: number;
  };
}

export interface Race {
  id: string;
  name: string;
  type: RaceType;
  seasonId: string;
  entryFee: number;
  maxEntrants: number;
  currentEntrants: number;
  deadline: Date;
  status: 'open' | 'running' | 'completed';
  createdAt: Date;
}

export interface RaceResult {
  raceId: string;
  position: number;
  creatureId: string;
  creatureName: string;
  creatureRarity: Rarity;
  ownerId: string;
  ownerAddress: string;
  performanceScore: number;
  payout: number;
  breakdown?: {
    baseScore: number;
    trainedBonus: number;
    modifiers: number;
    finalScore: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  creatureId: string;
  creatureName: string;
  creatureRarity: Rarity;
  ownerId: string;
  ownerAddress: string;
  wins: number;
  places: number;
  shows: number;
  totalRaces: number;
  earnings: number;
}

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

// Current user wallet (mock)
export const mockWalletAddress = '0x7a3B...4f2E';
export const mockUserId = 'user_001';

// Current Season
export const currentSeason: Season = {
  id: 'season_001',
  name: 'Neon Storm',
  modifier: '+15% Speed Bonus',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-03-31'),
  prizePool: {
    win: 50000,
    place: 25000,
    show: 15000,
    total: 90000,
  },
};

// Mock Creatures
export const mockCreatures: Creature[] = [
  {
    id: 'creature_001',
    name: 'Voltex Prime',
    rarity: 'legendary',
    baseStats: { speed: 85, stamina: 70, acceleration: 80, agility: 75, heart: 65, focus: 72 },
    trainedStats: { speed: 12, stamina: 8, acceleration: 10, agility: 6, heart: 4, focus: 5 },
    fatigue: 35,
    sharpness: 85,
    cooldownEndsAt: null,
    prestigeTier: 2,
    lifetimeWins: 12,
    lifetimePlaces: 8,
    lifetimeShows: 5,
    totalRaces: 42,
    totalEarnings: 15400,
    ownerId: mockUserId,
    bonusActions: 1,
    boostMultiplier: 0,
    actionsRemaining: 3,
    maxActionsToday: 3,
  },
  {
    id: 'creature_002',
    name: 'Shadow Runner',
    rarity: 'epic',
    baseStats: { speed: 72, stamina: 85, acceleration: 65, agility: 80, heart: 78, focus: 68 },
    trainedStats: { speed: 5, stamina: 15, acceleration: 3, agility: 8, heart: 10, focus: 4 },
    fatigue: 60,
    sharpness: 45,
    cooldownEndsAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
    prestigeTier: 1,
    lifetimeWins: 6,
    lifetimePlaces: 12,
    lifetimeShows: 9,
    totalRaces: 38,
    totalEarnings: 8200,
    ownerId: mockUserId,
    bonusActions: 0,
    boostMultiplier: 0.50,
    actionsRemaining: 2,
    maxActionsToday: 2,
  },
  {
    id: 'creature_003',
    name: 'Cyber Phantom',
    rarity: 'cyberium',
    baseStats: { speed: 92, stamina: 88, acceleration: 90, agility: 86, heart: 82, focus: 85 },
    trainedStats: { speed: 8, stamina: 6, acceleration: 7, agility: 5, heart: 4, focus: 6 },
    fatigue: 15,
    sharpness: 95,
    cooldownEndsAt: null,
    prestigeTier: 3,
    lifetimeWins: 28,
    lifetimePlaces: 15,
    lifetimeShows: 8,
    totalRaces: 65,
    totalEarnings: 42500,
    ownerId: mockUserId,
    bonusActions: 0,
    boostMultiplier: 0.25,
    actionsRemaining: 2,
    maxActionsToday: 2,
  },
  {
    id: 'creature_004',
    name: 'Neon Striker',
    rarity: 'rare',
    baseStats: { speed: 68, stamina: 65, acceleration: 72, agility: 70, heart: 60, focus: 58 },
    trainedStats: { speed: 2, stamina: 3, acceleration: 4, agility: 2, heart: 1, focus: 2 },
    fatigue: 80,
    sharpness: 30,
    cooldownEndsAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
    prestigeTier: 0,
    lifetimeWins: 2,
    lifetimePlaces: 5,
    lifetimeShows: 8,
    totalRaces: 22,
    totalEarnings: 1800,
    ownerId: mockUserId,
    bonusActions: 0,
    boostMultiplier: 0.10,
    actionsRemaining: 2,
    maxActionsToday: 2,
  },
];

// Mock Races
export const mockRaces: Race[] = [
  {
    id: 'race_001',
    name: 'Midnight Circuit',
    type: 'sprint',
    seasonId: currentSeason.id,
    entryFee: 50,
    maxEntrants: 8,
    currentEntrants: 5,
    deadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
    status: 'open',
    createdAt: new Date(),
  },
  {
    id: 'race_002',
    name: 'Endurance Marathon',
    type: 'distance',
    seasonId: currentSeason.id,
    entryFee: 100,
    maxEntrants: 12,
    currentEntrants: 8,
    deadline: new Date(Date.now() + 5 * 60 * 60 * 1000),
    status: 'open',
    createdAt: new Date(),
  },
  {
    id: 'race_003',
    name: 'Neon Slalom',
    type: 'technical',
    seasonId: currentSeason.id,
    entryFee: 75,
    maxEntrants: 6,
    currentEntrants: 6,
    deadline: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: 'running',
    createdAt: new Date(),
  },
  {
    id: 'race_004',
    name: 'Chaos Gauntlet',
    type: 'hazard',
    seasonId: currentSeason.id,
    entryFee: 150,
    maxEntrants: 10,
    currentEntrants: 3,
    deadline: new Date(Date.now() + 8 * 60 * 60 * 1000),
    status: 'open',
    createdAt: new Date(),
  },
  {
    id: 'race_005',
    name: 'Grand Prix Mix',
    type: 'mixed',
    seasonId: currentSeason.id,
    entryFee: 200,
    maxEntrants: 8,
    currentEntrants: 7,
    deadline: new Date(Date.now() + 1 * 60 * 60 * 1000),
    status: 'open',
    createdAt: new Date(),
  },
];

// Past Race Results
export const mockRaceResults: RaceResult[] = [
  {
    raceId: 'race_past_001',
    position: 1,
    creatureId: 'creature_003',
    creatureName: 'Cyber Phantom',
    creatureRarity: 'cyberium',
    ownerId: mockUserId,
    ownerAddress: mockWalletAddress,
    performanceScore: 9850,
    payout: 1500,
    breakdown: { baseScore: 8200, trainedBonus: 850, modifiers: 800, finalScore: 9850 },
  },
  {
    raceId: 'race_past_001',
    position: 2,
    creatureId: 'creature_ext_001',
    creatureName: 'Thunder Bolt',
    creatureRarity: 'legendary',
    ownerId: 'user_002',
    ownerAddress: '0x3c1F...8a2D',
    performanceScore: 9200,
    payout: 800,
  },
  {
    raceId: 'race_past_001',
    position: 3,
    creatureId: 'creature_001',
    creatureName: 'Voltex Prime',
    creatureRarity: 'legendary',
    ownerId: mockUserId,
    ownerAddress: mockWalletAddress,
    performanceScore: 8900,
    payout: 400,
    breakdown: { baseScore: 7500, trainedBonus: 680, modifiers: 720, finalScore: 8900 },
  },
];

// Leaderboard data
export const mockLeaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    creatureId: 'creature_003',
    creatureName: 'Cyber Phantom',
    creatureRarity: 'cyberium',
    ownerId: mockUserId,
    ownerAddress: mockWalletAddress,
    wins: 28,
    places: 15,
    shows: 8,
    totalRaces: 65,
    earnings: 42500,
  },
  {
    rank: 2,
    creatureId: 'creature_ext_002',
    creatureName: 'Plasma Storm',
    creatureRarity: 'mythic',
    ownerId: 'user_003',
    ownerAddress: '0x9d4E...2c1A',
    wins: 25,
    places: 18,
    shows: 12,
    totalRaces: 72,
    earnings: 38200,
  },
  {
    rank: 3,
    creatureId: 'creature_ext_001',
    creatureName: 'Thunder Bolt',
    creatureRarity: 'legendary',
    ownerId: 'user_002',
    ownerAddress: '0x3c1F...8a2D',
    wins: 22,
    places: 20,
    shows: 15,
    totalRaces: 80,
    earnings: 35600,
  },
  {
    rank: 4,
    creatureId: 'creature_001',
    creatureName: 'Voltex Prime',
    creatureRarity: 'legendary',
    ownerId: mockUserId,
    ownerAddress: mockWalletAddress,
    wins: 12,
    places: 8,
    shows: 5,
    totalRaces: 42,
    earnings: 15400,
  },
  {
    rank: 5,
    creatureId: 'creature_ext_003',
    creatureName: 'Frost Weaver',
    creatureRarity: 'epic',
    ownerId: 'user_004',
    ownerAddress: '0x5f2B...7e3C',
    wins: 10,
    places: 14,
    shows: 18,
    totalRaces: 55,
    earnings: 12800,
  },
];

// Training Activities
export const trainingActivities: TrainingActivity[] = [
  {
    id: 'train_sprint',
    name: 'Sprint Drills',
    icon: 'Zap',
    primaryStat: 'speed',
    secondaryStat: 'acceleration',
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
    secondaryStat: 'acceleration',
    primaryGain: 3,
    secondaryGain: 1,
    fatigueCost: 18,
    description: 'Obstacle navigation for quick reflexes and nimble movement.',
  },
  {
    id: 'train_gate',
    name: 'Gate Work',
    icon: 'Timer',
    primaryStat: 'acceleration',
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

// Helper functions
export function getCreatureById(id: string): Creature | undefined {
  return mockCreatures.find(c => c.id === id);
}

export function getRaceById(id: string): Race | undefined {
  return mockRaces.find(r => r.id === id);
}

export function getUserCreatures(userId: string = mockUserId): Creature[] {
  return mockCreatures.filter(c => c.ownerId === userId);
}

export function getRarityColor(rarity: Rarity): string {
  const colors: Record<Rarity, string> = {
    common: 'rarity-common',
    uncommon: 'rarity-uncommon',
    rare: 'rarity-rare',
    masterwork: 'rarity-masterwork',
    epic: 'rarity-epic',
    relic: 'rarity-relic',
    legendary: 'rarity-legendary',
    mythic: 'rarity-mythic',
    cyberium: 'rarity-mythic', // uses holographic effect
  };
  return colors[rarity];
}

export function getRaceTypeColor(type: RaceType): string {
  const colors: Record<RaceType, string> = {
    sprint: 'race-sprint',
    distance: 'race-distance',
    technical: 'race-technical',
    mixed: 'race-mixed',
    hazard: 'race-hazard',
  };
  return colors[type];
}

export function formatCountdown(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  
  if (diff <= 0) return 'Ready!';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  return `${hours}h ${minutes}m`;
}

export function formatDaysRemaining(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
