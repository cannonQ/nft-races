/**
 * Aneta Angels collection loader.
 *
 * Loads aneta_angel_traits.json once at module scope (cached across warm invocations).
 * Implements the CollectionLoader interface for the racing platform.
 *
 * Trait → stat mapping:
 *   Wings → SPD, Body → STM, Face → HRT, Head → ACC, Background → AGI
 *   Skin Tone → Focus (separate from 5-stat budget)
 *
 * Rarity tiers (percentile-based):
 *   Common (30%), Uncommon (30%), Rare (20%), Epic (12%), Legendary (6%), Mythic (2%)
 *
 * Stat distribution uses weighted formula:
 *   trait_weight = norm_score / total_norm_score
 *   stat = floor + (budget - 5*floor) * trait_weight
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CollectionLoader, TokenEntry, Stats, StatName } from './types.js';
import { STAT_KEYS } from './types.js';

// ---------------------------------------------------------------------------
// Types (Aneta Angels-specific)
// ---------------------------------------------------------------------------

interface AnetaAngelToken {
  token_id: string;
  name: string;
  number: number;
  traits: {
    Wings: string;
    Body: string;
    Face: string;
    Head: string;
    Background: string;
    'Skin Tone': string;
  };
  rarity_tier: string;
  rarity_score: number;
  normalized_scores: {
    Wings: number;
    Body: number;
    Face: number;
    Head: number;
    Background: number;
  };
  status?: string;
  ipfsUrl?: string;
}

export interface ParsedAnetaTraits {
  rarity_tier: string;
  rarity_score: number;
  wings: string;
  body: string;
  face: string;
  head: string;
  background: string;
  skinTone: string;
  normalized_scores: Record<string, number>;
}

// Default trait → stat mapping
const DEFAULT_STAT_MAP: Record<string, StatName> = {
  Wings: 'speed',
  Body: 'stamina',
  Face: 'heart',
  Head: 'accel',
  Background: 'agility',
};

// Default Focus values from Skin Tone (mapped to stat scale 0-80)
const DEFAULT_FOCUS_MAP: Record<string, number> = {
  'Tone 1': 40,
  'Tone 2': 25,
  'Tone 3': 15,
  'Tone 4': 5,
};

// Default stat floor (minimum per stat before distribution)
const DEFAULT_FLOOR = 2;

// ---------------------------------------------------------------------------
// Module-level cache (warm serverless invocations)
// ---------------------------------------------------------------------------

let _tokens: AnetaAngelToken[] | null = null;
let _tokenIndex: Map<string, AnetaAngelToken> | null = null;

function loadTokens(): AnetaAngelToken[] {
  if (!_tokens) {
    const jsonPath = path.resolve(process.cwd(), 'data/ergo/aneta-angels/aneta_angel_traits.json');
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(raw);
      _tokens = (data.tokens as AnetaAngelToken[]).filter(
        t => !t.status || t.status === 'circulating',
      );
    } catch (err) {
      // File may not exist yet — this is expected during initial setup
      console.warn(`[aneta-angels] Could not load ${jsonPath} — collection data not available yet`);
      _tokens = [];
    }
  }
  return _tokens;
}

function getTokenIndex(): Map<string, AnetaAngelToken> {
  if (!_tokenIndex) {
    _tokenIndex = new Map();
    for (const t of loadTokens()) {
      _tokenIndex.set(t.token_id, t);
    }
  }
  return _tokenIndex;
}

// ---------------------------------------------------------------------------
// CollectionLoader implementation
// ---------------------------------------------------------------------------

export class AnetaAngelsLoader implements CollectionLoader {
  readonly slug = 'Aneta Angels';

  isToken(tokenId: string): boolean {
    return getTokenIndex().has(tokenId);
  }

  getToken(tokenId: string): TokenEntry | undefined {
    return getTokenIndex().get(tokenId);
  }

  parseTraits(token: TokenEntry): ParsedAnetaTraits | null {
    const t = token as AnetaAngelToken;
    if (!t.traits || !t.rarity_tier) return null;

    return {
      rarity_tier: t.rarity_tier,
      rarity_score: t.rarity_score ?? 0,
      wings: t.traits.Wings ?? 'Unknown',
      body: t.traits.Body ?? 'Unknown',
      face: t.traits.Face ?? 'Unknown',
      head: t.traits.Head ?? 'Unknown',
      background: t.traits.Background ?? 'Unknown',
      skinTone: t.traits['Skin Tone'] ?? 'Tone 3',
      normalized_scores: t.normalized_scores ?? {},
    };
  }

  computeBaseStats(
    traits: Record<string, any>,
    baseStatTemplate: Record<string, any>,
    traitMapping: Record<string, any>,
  ): Stats {
    const rarity = traits.rarity_tier || 'Common';
    const tier = baseStatTemplate[rarity] || baseStatTemplate['Common'] || {};
    const budget: number = tier.total_base ?? 60;

    // Trait → stat mapping from DB config or defaults
    const statMap: Record<string, StatName> = traitMapping?.stat_map ?? DEFAULT_STAT_MAP;
    const focusMap: Record<string, number> = traitMapping?.focus_map ?? DEFAULT_FOCUS_MAP;
    const floor: number = traitMapping?.floor ?? tier.floor ?? DEFAULT_FLOOR;

    const normScores: Record<string, number> = traits.normalized_scores ?? {};
    const totalNorm = Object.values(normScores).reduce((sum: number, v: any) => sum + (v as number), 0);

    const stats: Stats = { speed: 0, stamina: 0, accel: 0, agility: 0, heart: 0, focus: 0 };

    // Set floor for the 5 main stats
    const mainStats: StatName[] = ['speed', 'stamina', 'accel', 'agility', 'heart'];
    for (const s of mainStats) {
      stats[s] = floor;
    }

    // Distribute remaining budget proportionally based on normalized trait scores
    const distributable = Math.max(0, budget - mainStats.length * floor);

    if (totalNorm > 0) {
      for (const [traitCategory, statName] of Object.entries(statMap)) {
        const normScore = normScores[traitCategory] ?? 0;
        const weight = normScore / totalNorm;
        stats[statName] += distributable * weight;
      }
    } else {
      // Even distribution if all scores are 0 (theoretical floor case)
      const perStat = distributable / mainStats.length;
      for (const s of mainStats) {
        stats[s] += perStat;
      }
    }

    // Focus from Skin Tone (separate from stat budget)
    stats.focus = focusMap[traits.skinTone] ?? DEFAULT_FOCUS_MAP['Tone 3'] ?? 15;

    // Round and clamp all stats
    for (const key of STAT_KEYS) {
      stats[key] = Math.round(Math.min(80, Math.max(0, stats[key])) * 100) / 100;
    }

    return stats;
  }

  buildMetadata(token: TokenEntry, traits: Record<string, any>): Record<string, any> {
    const t = token as AnetaAngelToken;
    return {
      wings: traits.wings,
      body: traits.body,
      face: traits.face,
      head: traits.head,
      background: traits.background,
      skinTone: traits.skinTone,
      number: t.number,
      rarity_score: traits.rarity_score,
      normalized_scores: traits.normalized_scores,
      token_id: t.token_id,
      ipfsUrl: t.ipfsUrl,
    };
  }

  getImageUrl(metadata: Record<string, any>): string | undefined {
    // Route through our image proxy for CDN caching + HTTPS
    if (metadata?.token_id) {
      return `/api/v2/img/token/${metadata.token_id}`;
    }
    return undefined;
  }

  getFallbackImageUrl(metadata: Record<string, any>): string | undefined {
    if (metadata?.token_id) {
      return `https://api.ergexplorer.com/nftcache/${metadata.token_id}`;
    }
    return undefined;
  }

  getDisplayName(metadata: Record<string, any>, fallbackName: string): string {
    // Aneta Angels names come from the token name (e.g., "Aneta #0581")
    return fallbackName;
  }

  getRarity(traits: Record<string, any>): string {
    return (traits.rarity_tier || 'Common').toLowerCase();
  }
}
