/**
 * Convert aneta_angels_scored.json (from the rarity scoring pipeline)
 * into aneta_angel_traits.json (the format expected by the game's collection loader).
 *
 * Input:  ../NFT Collections/aneta_angels_scored.json
 * Output: data/ergo/aneta-angels/aneta_angel_traits.json
 *
 * Usage: npx tsx scripts/convert-aneta-traits.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = path.resolve(__dirname, '../../NFT Collections/aneta_angels_scored.json');
const OUTPUT_PATH = path.resolve(__dirname, '../data/ergo/aneta-angels/aneta_angel_traits.json');

interface ScoredToken {
  tokenId: string;
  name: string;
  traits: {
    Wings: string;
    'Skin Tone': string;
    Body: string;
    Face: string;
    Head: string;
    Background: string;
  };
  status: string;
  scoring: {
    breakdown: Record<string, { value: string; raw_score: number; normalized: number }>;
    total_score: number;
  };
  tier: {
    name: string;
    percentile: number;
  };
}

interface OutputToken {
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
  status: string;
}

// Extract number from name like "Aneta #0581" → 581
function extractNumber(name: string): number {
  const match = name.match(/#(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function main() {
  console.log(`Reading: ${INPUT_PATH}`);
  const raw = fs.readFileSync(INPUT_PATH, 'utf-8');
  const scored = JSON.parse(raw);

  const tokens: ScoredToken[] = scored.tokens;
  console.log(`Total tokens in scored file: ${tokens.length}`);

  // Filter to active tokens only
  const active = tokens.filter(t => t.status === 'active');
  console.log(`Active (circulating) tokens: ${active.length}`);

  const output: OutputToken[] = active.map(t => ({
    token_id: t.tokenId,
    name: t.name,
    number: extractNumber(t.name),
    traits: {
      Wings: t.traits.Wings,
      Body: t.traits.Body,
      Face: t.traits.Face,
      Head: t.traits.Head,
      Background: t.traits.Background,
      'Skin Tone': t.traits['Skin Tone'],
    },
    rarity_tier: t.tier.name,
    rarity_score: t.scoring.total_score,
    normalized_scores: {
      Wings: t.scoring.breakdown.Wings?.normalized ?? 0,
      Body: t.scoring.breakdown.Body?.normalized ?? 0,
      Face: t.scoring.breakdown.Face?.normalized ?? 0,
      Head: t.scoring.breakdown.Head?.normalized ?? 0,
      Background: t.scoring.breakdown.Background?.normalized ?? 0,
    },
    status: 'circulating',
  }));

  // Sort by number for readability
  output.sort((a, b) => a.number - b.number);

  // Wrap in the same structure the loader expects
  const result = {
    collection: 'Aneta Angels',
    generated_at: new Date().toISOString(),
    total_tokens: output.length,
    tokens: output,
  };

  // Ensure output directory exists
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`Written: ${OUTPUT_PATH} (${output.length} tokens)`);

  // Print tier distribution
  const tierCounts: Record<string, number> = {};
  for (const t of output) {
    tierCounts[t.rarity_tier] = (tierCounts[t.rarity_tier] || 0) + 1;
  }
  console.log('\nTier distribution:');
  for (const [tier, count] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier}: ${count} (${((count / output.length) * 100).toFixed(1)}%)`);
  }
}

main();
