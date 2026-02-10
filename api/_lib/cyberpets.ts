/**
 * CyberPets data utilities for serverless functions.
 *
 * Loads cyber_pet_traits.json at module scope (cached across warm invocations),
 * provides trait parsing, base-stat computation, and token validation.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenEntry {
  token_id: string;
  name: string;
  description: string;
  number: number;
  current_holder: string;
  status: string;
}

export interface ParsedTraits {
  rarity: string;
  pet: string;
  skinColor: string;
  background: string;
  stage: string;
  bodyParts: string[];
  bodyPartCount: number;
  materialQuality: number;
}

type StatName = 'speed' | 'stamina' | 'accel' | 'agility' | 'heart' | 'focus';
type Stats = Record<StatName, number>;

const STAT_KEYS: StatName[] = ['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'];

const MATERIAL_QUALITY: Record<string, number> = {
  cyberium: 4,
  diamond: 3,
  golden: 2,
  silver: 1,
};

// ---------------------------------------------------------------------------
// Load JSON once (stays in memory for warm serverless invocations)
// ---------------------------------------------------------------------------

let _tokens: TokenEntry[] | null = null;
let _tokenIndex: Map<string, TokenEntry> | null = null;

function loadTokens(): TokenEntry[] {
  if (!_tokens) {
    const jsonPath = path.resolve(process.cwd(), 'data/ergo/cyberpets/cyber_pet_traits.json');
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(raw);
      _tokens = (data.tokens as TokenEntry[]).filter(t => t.status === 'circulating');
      console.log(`[cyberpets] Loaded ${_tokens.length} circulating tokens from ${jsonPath}`);
    } catch (err) {
      console.error(`[cyberpets] FAILED to load ${jsonPath}:`, err);
      _tokens = [];
    }
  }
  return _tokens;
}

function getTokenIndex(): Map<string, TokenEntry> {
  if (!_tokenIndex) {
    _tokenIndex = new Map();
    for (const t of loadTokens()) {
      _tokenIndex.set(t.token_id, t);
    }
  }
  return _tokenIndex;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Check if a token_id belongs to a circulating CyberPet */
export function isCyberPet(tokenId: string): boolean {
  return getTokenIndex().has(tokenId);
}

/** Get a CyberPet token entry by token_id, or null */
export function getToken(tokenId: string): TokenEntry | null {
  return getTokenIndex().get(tokenId) ?? null;
}

// ---------------------------------------------------------------------------
// Trait parsing (same logic as scripts/register-cyberpets.ts)
// ---------------------------------------------------------------------------

export function parseTraits(description: string): ParsedTraits | null {
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

    // Material quality from body parts
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
      rarity: traits['Rarity'] || 'Common',
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
// Base stat computation (same logic as scripts/register-cyberpets.ts)
// ---------------------------------------------------------------------------

export function computeBaseStats(
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
