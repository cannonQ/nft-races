/**
 * CyberPets collection loader.
 *
 * Loads cyber_pet_traits.json once at module scope (cached across warm invocations).
 * Implements the CollectionLoader interface for the racing platform.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CollectionLoader, TokenEntry, Stats, StatName } from './types.js';
import { STAT_KEYS } from './types.js';

// ---------------------------------------------------------------------------
// Types (CyberPets-specific)
// ---------------------------------------------------------------------------

interface CyberPetToken {
  token_id: string;
  name: string;
  description: string;
  number: number;
  current_holder: string;
  status: string;
}

export interface ParsedCyberPetTraits {
  rarity: string;
  pet: string;
  skinColor: string;
  background: string;
  stage: string;
  bodyParts: string[];
  bodyPartCount: number;
  materialQuality: number;
}

const MATERIAL_QUALITY: Record<string, number> = {
  cyberium: 4,
  diamond: 3,
  golden: 2,
  silver: 1,
};

// ---------------------------------------------------------------------------
// Module-level cache (warm serverless invocations)
// ---------------------------------------------------------------------------

let _tokens: CyberPetToken[] | null = null;
let _tokenIndex: Map<string, CyberPetToken> | null = null;

function loadTokens(): CyberPetToken[] {
  if (!_tokens) {
    const jsonPath = path.resolve(process.cwd(), 'data/ergo/cyberpets/cyber_pet_traits.json');
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(raw);
      _tokens = (data.tokens as CyberPetToken[]).filter(t => t.status === 'circulating');
    } catch (err) {
      console.error(`[cyberpets] FAILED to load ${jsonPath}:`, err);
      _tokens = [];
    }
  }
  return _tokens;
}

function getTokenIndex(): Map<string, CyberPetToken> {
  if (!_tokenIndex) {
    _tokenIndex = new Map();
    for (const t of loadTokens()) {
      _tokenIndex.set(t.token_id, t);
    }
  }
  return _tokenIndex;
}

// ---------------------------------------------------------------------------
// Trait parsing
// ---------------------------------------------------------------------------

function parseCyberPetTraits(description: string): ParsedCyberPetTraits | null {
  try {
    const parsed = JSON.parse(description);
    let traits: Record<string, string>;

    if (parsed['721']) {
      const keys = Object.keys(parsed['721']);
      if (keys.length === 0) return null;
      traits = parsed['721'][keys[0]].traits || parsed['721'][keys[0]];
    } else {
      traits = parsed;
    }

    const bodyParts: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const part = traits[`Body part ${i}`];
      if (part) bodyParts.push(part);
    }

    let materialQuality = 0;
    for (const part of bodyParts) {
      const lower = part.toLowerCase();
      for (const [material, quality] of Object.entries(MATERIAL_QUALITY)) {
        if (lower.includes(material) && quality > materialQuality) {
          materialQuality = quality;
        }
      }
    }

    return {
      rarity: (traits['Rarity'] || 'Common').toLowerCase(),
      pet: traits['Pet'] || 'Unknown',
      skinColor: traits['Skin Color'] || 'Unknown',
      background: traits['Background'] || 'Unknown',
      stage: traits['Stage'] || '1',
      bodyParts,
      bodyPartCount: bodyParts.length,
      materialQuality,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Base stat computation
// ---------------------------------------------------------------------------

function computeCyberPetBaseStats(
  rarity: string,
  bodyPartCount: number,
  materialQuality: number,
  baseStatTemplate: Record<string, any>,
  traitMapping: Record<string, any>,
): Stats {
  const tier = baseStatTemplate[rarity] || baseStatTemplate['Common'] || {};
  const totalBase: number = tier.total_base ?? 60;
  const bias: Partial<Stats> = tier.bias ?? {};

  const stats: Stats = { speed: 0, stamina: 0, accel: 0, agility: 0, heart: 0, focus: 0 };
  let allocated = 0;

  for (const key of STAT_KEYS) {
    stats[key] = bias[key] ?? 0;
    allocated += stats[key];
  }

  if (allocated < totalBase) {
    const remaining = totalBase - allocated;
    const perStat = remaining / STAT_KEYS.length;
    for (const key of STAT_KEYS) {
      stats[key] += perStat;
    }
  }

  const staminaPerPart: number = traitMapping?.body_part_count?.stamina_per_part ?? 0.5;
  stats.stamina += bodyPartCount * staminaPerPart;

  const focusPerQuality: number = traitMapping?.material_quality?.focus_per_level ?? 0.5;
  stats.focus += materialQuality * focusPerQuality;

  let currentTotal = STAT_KEYS.reduce((s, k) => s + stats[k], 0);
  if (currentTotal > totalBase) {
    const scale = totalBase / currentTotal;
    for (const key of STAT_KEYS) {
      stats[key] = stats[key] * scale;
    }
  }

  for (const key of STAT_KEYS) {
    stats[key] = Math.round(Math.min(80, Math.max(0, stats[key])) * 100) / 100;
  }

  return stats;
}

// ---------------------------------------------------------------------------
// CollectionLoader implementation
// ---------------------------------------------------------------------------

export class CyberPetsLoader implements CollectionLoader {
  readonly slug = 'CyberPets';

  isToken(tokenId: string): boolean {
    return getTokenIndex().has(tokenId);
  }

  getToken(tokenId: string): TokenEntry | undefined {
    return getTokenIndex().get(tokenId);
  }

  parseTraits(token: TokenEntry): ParsedCyberPetTraits | null {
    return parseCyberPetTraits(token.description);
  }

  computeBaseStats(
    traits: Record<string, any>,
    baseStatTemplate: Record<string, any>,
    traitMapping: Record<string, any>,
  ): Stats {
    return computeCyberPetBaseStats(
      traits.rarity,
      traits.bodyPartCount,
      traits.materialQuality,
      baseStatTemplate,
      traitMapping,
    );
  }

  buildMetadata(token: TokenEntry, traits: Record<string, any>): Record<string, any> {
    return {
      pet: traits.pet,
      skinColor: traits.skinColor,
      background: traits.background,
      stage: traits.stage,
      bodyParts: traits.bodyParts,
      bodyPartCount: traits.bodyPartCount,
      materialQuality: traits.materialQuality,
      number: (token as CyberPetToken).number,
    };
  }

  getImageUrl(metadata: Record<string, any>): string | undefined {
    return metadata?.number != null
      ? `/api/v2/img/${metadata.number}`
      : undefined;
  }

  getFallbackImageUrl(metadata: Record<string, any>): string | undefined {
    return metadata?.number != null
      ? `https://www.cyberversewiki.com/img/cyberpets/${metadata.number}.png`
      : undefined;
  }

  getDisplayName(metadata: Record<string, any>, fallbackName: string): string {
    if (metadata?.pet && metadata?.number != null) {
      return `${metadata.pet} ${metadata.number}`;
    }
    return fallbackName;
  }

  getRarity(traits: Record<string, any>): string {
    return traits.rarity || 'Common';
  }
}

// ---------------------------------------------------------------------------
// Backward-compat named exports (used by api/_lib/cyberpets.ts re-exports)
// ---------------------------------------------------------------------------

export { loadTokens, getTokenIndex, parseCyberPetTraits as parseTraits };

export function isCyberPet(tokenId: string): boolean {
  return getTokenIndex().has(tokenId);
}

export function getCyberPetToken(tokenId: string): CyberPetToken | null {
  return getTokenIndex().get(tokenId) ?? null;
}

export { computeCyberPetBaseStats as computeBaseStats };
