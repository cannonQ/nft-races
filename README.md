# CyberPets Racing

Provably fair async racing for CyberPets NFTs on Ergo blockchain.

## How It Works

1. **Race Created** - Server generates a secret seed, publishes only the hash
2. **Entry Period** - Players sign a message with their wallet (signature = player seed)
3. **Deadline Passes** - No more entries accepted
4. **Resolution** - Combined seed = hash(server_seed + all_signatures), race simulated deterministically
5. **Verification** - Anyone can re-run the simulation and verify results

## Fairness Guarantees

- Server seed is committed (hashed) before any entries
- Player seeds are their wallet signatures (can't be faked)
- Combined seed is deterministic from all inputs
- Anyone can verify using `verify-race.ts`

## Tech Stack

- **Database**: Supabase (PostgreSQL)
- **Backend**: Vercel Serverless Functions
- **Blockchain**: Ergo (wallet signatures, NFT ownership)
- **Frontend**: Next.js (optional)

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a project
2. Run `schema.sql` in the SQL editor
3. Copy your project URL and keys

### 2. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
CRON_SECRET=your-random-secret
```

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

```bash
vercel
```

Add environment variables in Vercel dashboard.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/races` | GET | List races by status |
| `/api/races/[id]` | GET | Get race details + entries |
| `/api/races/enter` | POST | Enter a race |
| `/api/races/create` | POST | Create new race (admin) |
| `/api/races/resolve` | POST | Resolve pending races (cron) |
| `/api/verify/[id]` | GET | Public verification |
| `/api/leaderboard` | GET | NFT/owner leaderboards |

## Race Entry Flow

```typescript
// 1. User selects NFT and race
const raceId = 'abc-123';
const nftTokenId = '20a0dad...';

// 2. Create signing message
const message = `CYBERPETS-RACE:${raceId}:${nftTokenId}`;

// 3. Sign with wallet (Nautilus, etc.)
const signature = await wallet.signMessage(message);

// 4. Submit entry
await fetch('/api/races/enter', {
  method: 'POST',
  body: JSON.stringify({
    raceId,
    nftTokenId,
    nftName: 'CyberPet #1906',
    nftDescription: '{"Rarity": "Cyberium", ...}',
    ownerAddress: '9hsfyMNR...',
    signature
  })
});
```

## Trait System

| Trait | Effect | Range |
|-------|--------|-------|
| Rarity | Speed multiplier | 1.00x - 1.10x |
| Body Parts | Consistency (less variance) | 0.50 - 0.82 |

### Rarity Multipliers

| Rarity | Count | Multiplier |
|--------|-------|------------|
| Common | 141 | 1.00x |
| Uncommon | 99 | 1.01x |
| Rare | 72 | 1.02x |
| Epic | 50 | 1.04x |
| Legendary | 35 | 1.05x |
| Mythic | 27 | 1.06x |
| Relic | 19 | 1.07x |
| Masterwork | 14 | 1.08x |
| Cyberium | 3 | 1.10x |

## Payout Structure

| Position | Share |
|----------|-------|
| 1st | 50% |
| 2nd | 30% |
| 3rd | 15% |
| House | 5% |

## Verify a Race

```bash
# Set environment variables
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_ANON_KEY=eyJ...

# Run verification
npx ts-node verify-race.ts <race-id>
```

Output:
```
🏁 Verifying Race: abc-123

🔐 Step 1: Verify server seed hash...
   ✅ Match: YES

🔗 Step 2: Verify combined seed...
   ✅ Match: YES

🎲 Step 3: Re-run race simulation...

📊 Step 4: Compare results...

   Pos | NFT Name                | Distance
   ✅ 1  | CyberPet #1906          |    1052.34
   ✅ 2  | CyberPet #612           |    1038.91
   ✅ 3  | CyberPet #2422          |     987.65

✅ VERIFICATION PASSED
```

## House NFTs

House NFTs fill races when there aren't enough entries:
- They compete fairly using the same system
- If they win, payouts go to the actual NFT holder
- Configured in `house_nfts` table

## File Structure

```
cyberpets-racing/
├── schema.sql              # Supabase database schema
├── src/
│   ├── traits.ts           # Trait parsing & stats
│   ├── race-engine.ts      # Deterministic simulation
│   ├── race-resolution.ts  # Resolution service
│   ├── ergo-verify.ts      # Signature verification
│   └── api-routes.ts       # API route templates
├── verify-race.ts          # Public verification script
└── package.json
```

## License

MIT

## CyberPets Trait Box
Box ID:    a9af56f8cae018dc69c36eeb3a89f7a17d306cf5f86203d60cc77a25444d90fe
TX ID:     c988253964cba60b9eea9110c400d545ea3bcb49ce8ad8e5842f1070da3da744
Root Hash: 25a513e4f2869fda20300c1e619d611f33e3d82eab53f05fc4f1b81b91c2a32b
Pets:      460
Size:      3,410 bytes
Block:     [1703589](https://ergexplorer.com/blocks#cd3ffb11a509686094af514dc53da5a7773221ac0a2d25e6081fe197338864f1)
