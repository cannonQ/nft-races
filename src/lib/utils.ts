import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { RaceType, Rarity } from "@/types/game";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a countdown from an ISO date string
 */
export function formatCountdown(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return 'Ready!';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  return `${hours}h ${minutes}m`;
}

/**
 * Calculate days remaining from an ISO date string
 */
export function formatDaysRemaining(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Get CSS class for rarity styling
 */
export function getRarityColor(rarity: Rarity): string {
  const colors: Record<Rarity, string> = {
    common: 'rarity-common',
    uncommon: 'rarity-uncommon',
    rare: 'rarity-rare',
    epic: 'rarity-epic',
    legendary: 'rarity-legendary',
    mythic: 'rarity-mythic',
    cyberium: 'rarity-mythic',
  };
  return colors[rarity];
}

/**
 * Format a stat number to at most 2 decimal places.
 * Strips trailing zeros: 10.00 → "10", 10.50 → "10.5", 10.37 → "10.37"
 */
export function fmtStat(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

/**
 * Get CSS class for race type styling
 */
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
