/**
 * API Routes for CyberPets Racing
 * Deploy to Vercel as serverless functions
 */

// ============================================
// /api/races/index.ts - List races
// ============================================
export const listRaces = `
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { status = 'open' } = req.query;
  
  const { data, error } = await supabase
    .from('races')
    .select(\`
      *,
      race_entries(count)
    \`)
    .eq('status', status)
    .order('entry_deadline', { ascending: true });
  
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  
  return res.status(200).json(data);
}
`;

// ============================================
// /api/races/[id].ts - Get race details
// ============================================
export const getRace = `
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  
  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('*')
    .eq('id', id)
    .single();
  
  if (raceError) {
    return res.status(404).json({ error: 'Race not found' });
  }
  
  const { data: entries } = await supabase
    .from('race_entries')
    .select('*')
    .eq('race_id', id)
    .order('final_position', { ascending: true, nullsFirst: false });
  
  return res.status(200).json({ race, entries });
}
`;

// ============================================
// /api/races/enter.ts - Enter a race
// ============================================
export const enterRace = `
import { createClient } from '@supabase/supabase-js';
import { verifyRaceEntry } from '@/lib/ergo-verify';
import { getStatsFromDescription } from '@/lib/traits';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { raceId, nftTokenId, nftName, nftDescription, ownerAddress, signature } = req.body;
  
  // Validate required fields
  if (!raceId || !nftTokenId || !ownerAddress || !signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Check race is open
  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('*')
    .eq('id', raceId)
    .eq('status', 'open')
    .single();
  
  if (raceError || !race) {
    return res.status(400).json({ error: 'Race not found or not open' });
  }
  
  // Check deadline
  if (new Date(race.entry_deadline) < new Date()) {
    return res.status(400).json({ error: 'Entry deadline passed' });
  }
  
  // Check not already entered
  const { data: existing } = await supabase
    .from('race_entries')
    .select('id')
    .eq('race_id', raceId)
    .eq('nft_token_id', nftTokenId)
    .single();
  
  if (existing) {
    return res.status(400).json({ error: 'NFT already entered in this race' });
  }
  
  // Verify signature and ownership
  const verification = await verifyRaceEntry(raceId, nftTokenId, signature, ownerAddress);
  
  if (!verification.valid) {
    return res.status(400).json({ error: verification.error });
  }
  
  // Parse traits and calculate stats
  const { traits, stats } = getStatsFromDescription(nftDescription);
  
  // Extract number from name (e.g., "CyberPet #1906" -> 1906)
  const numberMatch = nftName?.match(/#(\\d+)/);
  const nftNumber = numberMatch ? parseInt(numberMatch[1], 10) : null;
  
  // Insert entry
  const { data: entry, error: insertError } = await supabase
    .from('race_entries')
    .insert({
      race_id: raceId,
      nft_token_id: nftTokenId,
      nft_name: nftName,
      nft_number: nftNumber,
      owner_address: ownerAddress,
      signature,
      traits,
      speed_multiplier: stats.speedMultiplier,
      consistency: stats.consistency,
      is_house_nft: false
    })
    .select()
    .single();
  
  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }
  
  return res.status(200).json({ success: true, entry });
}
`;

// ============================================
// /api/races/create.ts - Create a new race (admin)
// ============================================
export const createRace = `
import { createClient } from '@supabase/supabase-js';
import { generateServerSeed } from '@/lib/race-engine';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // TODO: Add admin authentication
  const { entryDeadline, minEntries = 2, entryFee = 50000000 } = req.body;
  
  if (!entryDeadline) {
    return res.status(400).json({ error: 'Entry deadline required' });
  }
  
  // Generate server seed
  const { seed, hash } = generateServerSeed();
  
  const { data: race, error } = await supabase
    .from('races')
    .insert({
      entry_deadline: entryDeadline,
      server_seed_hash: hash,
      server_seed: seed, // Stored but not revealed until resolution
      min_entries: minEntries,
      entry_fee: entryFee,
      status: 'open'
    })
    .select()
    .single();
  
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  
  // Don't return server_seed in response
  const { server_seed, ...safeRace } = race;
  
  return res.status(200).json(safeRace);
}
`;

// ============================================
// /api/races/resolve.ts - Resolve race (cron)
// ============================================
export const resolveRaces = `
import { resolveAllPendingRaces, fillRaceWithHouseNfts } from '@/lib/race-resolution';

export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers.authorization !== \`Bearer \${process.env.CRON_SECRET}\`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  await resolveAllPendingRaces();
  
  return res.status(200).json({ success: true });
}

// Configure as Vercel cron in vercel.json:
// {
//   "crons": [{
//     "path": "/api/races/resolve",
//     "schedule": "0 * * * *"  // Every hour
//   }]
// }
`;

// ============================================
// /api/verify/[raceId].ts - Public verification
// ============================================
export const verifyRace = `
import { createClient } from '@supabase/supabase-js';
import { verifyRace as verifyRaceResult } from '@/lib/race-engine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { raceId } = req.query;
  
  // Fetch race
  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('*')
    .eq('id', raceId)
    .eq('status', 'resolved')
    .single();
  
  if (raceError || !race) {
    return res.status(404).json({ error: 'Resolved race not found' });
  }
  
  // Fetch entries
  const { data: entries } = await supabase
    .from('race_entries')
    .select('*')
    .eq('race_id', raceId)
    .eq('disqualified', false);
  
  // Build entry objects for verification
  const raceEntries = entries.map(e => ({
    nftTokenId: e.nft_token_id,
    nftName: e.nft_name,
    ownerAddress: e.owner_address,
    signature: e.signature,
    speedMultiplier: e.speed_multiplier,
    consistency: e.consistency,
    isHouseNft: e.is_house_nft
  }));
  
  // Run verification
  const verification = verifyRaceResult(
    race.server_seed,
    race.server_seed_hash,
    raceEntries,
    race.entry_fee,
    race.results
  );
  
  return res.status(200).json({
    raceId,
    verified: verification.valid,
    reason: verification.reason,
    serverSeed: race.server_seed,
    serverSeedHash: race.server_seed_hash,
    combinedSeed: race.combined_seed,
    entryCount: entries.length,
    results: race.results
  });
}
`;

// ============================================
// /api/leaderboard.ts - Get leaderboards
// ============================================
export const leaderboard = `
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { type = 'nft', limit = 20 } = req.query;
  
  if (type === 'owner') {
    const { data, error } = await supabase
      .from('owner_leaderboard')
      .select('*')
      .limit(parseInt(limit as string, 10));
    
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  
  // Default: NFT leaderboard
  const { data, error } = await supabase
    .from('nft_leaderboard')
    .select('*')
    .limit(parseInt(limit as string, 10));
  
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
}
`;

console.log('API routes exported as template strings.');
console.log('Copy each into separate files in /api/ directory.');
