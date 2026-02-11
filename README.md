# CyberPets Racing

Provably fair async NFT racing on the Ergo blockchain. Train your CyberPets, enter races, climb the leaderboard.

**Phase 1 (Alpha)** — game logic runs server-side with on-chain NFT ownership verification. Phase 2 will move all state and logic on-chain via ErgoScript smart contracts and AVL trees. See [PRE-architecture-sketch.md](PRE-architecture-sketch.md) for contract design notes.

## How It Works

1. Connect your Nautilus wallet
2. CyberPets in your wallet are auto-discovered and registered
3. Train your creatures — 6 activities targeting different stats, with diminishing returns
4. Enter races — stats are snapshot at entry time
5. Races resolve using deterministic RNG seeded from Ergo block hashes
6. Earn leaderboard points + boost rewards from race placements

## Tech Stack

| Component | Stack |
|-----------|-------|
| Frontend | Vite + React SPA |
| Backend | Vercel Serverless Functions (`api/`) |
| Database | Supabase (PostgreSQL) |
| Blockchain | Ergo (Explorer API for ownership verification) |
| Wallet | Nautilus (EIP-12 dApp connector) |

## Setup

### 1. Prerequisites

- Node.js 18+
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
- A [Supabase](https://supabase.com) project
- Nautilus wallet (browser extension)

### 2. Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

### 3. Database

Run the migrations in order in your Supabase SQL editor:

```
migrations/002_initial_schema.sql
migrations/003_creature_stats_numeric.sql
migrations/004_creature_stats_decimal.sql
migrations/005_season_races_views.sql
migrations/006_boost_rewards_table.sql
```

### 4. Install & Run

```bash
npm install
vercel dev
```

> Use `vercel dev` (not `npm run dev`) to get both the frontend and API routes working locally.

### 5. Deploy

```bash
vercel --prod
```

Add environment variables in the Vercel dashboard under Project Settings.

## API Endpoints

### Public

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/seasons/current` | GET | Active season info |
| `/api/v2/creatures/by-wallet/:address` | GET | All creatures for a wallet |
| `/api/v2/creatures/:id` | GET | Single creature with stats |
| `/api/v2/creatures/:id/training-log` | GET | Training history |
| `/api/v2/creatures/:id/race-history` | GET | Race entries for a creature |
| `/api/v2/races` | GET | Open + recent races |
| `/api/v2/races/:id/results` | GET | Race results with score breakdown |
| `/api/v2/leaderboard` | GET | Season standings |
| `/api/v2/config` | GET | Game config (activities, race weights) |
| `/api/v2/collections` | GET | List collections |
| `/api/v2/creatures/register` | POST | Register NFT (verifies on-chain ownership) |
| `/api/v2/train` | POST | Train creature |
| `/api/v2/races/:id/enter` | POST | Enter race |

### Admin (Bearer token auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/admin/seasons` | GET | List all seasons |
| `/api/v2/admin/seasons/start` | POST | Start new season |
| `/api/v2/admin/seasons/update` | POST | Edit active season |
| `/api/v2/admin/seasons/end` | POST | End season + compute payouts |
| `/api/v2/admin/races/create` | POST | Create race |
| `/api/v2/admin/races/update` | POST | Edit open race |
| `/api/v2/admin/races/resolve` | POST | Resolve race |
| `/api/v2/admin/races/reopen` | POST | Reopen cancelled race |

## Game Mechanics

- **6 stats**: speed, stamina, accel, agility, heart, focus (cap: 80 each, 300 total)
- **Diminishing returns**: `gain = base_gain * (1 - current_stat / 80)`
- **5 race types**: sprint, distance, technical, mixed, hazard — each weights stats differently
- **Condition**: fatigue (penalty) and sharpness (bonus) affect race performance
- **RNG**: `sha256(blockHash + creatureId)` via seedrandom — deterministic and verifiable
- **Rewards**: 1st gets bonus action, 2nd-4th+ get training boost multipliers (expire after ~3 days)

## Project Structure

```
api/                    # Vercel Serverless Functions
  _lib/                 # Shared server utilities (supabase, auth, helpers)
  v2/                   # All API endpoints
    admin/              # Admin-only endpoints (seasons, races)
    creatures/          # Creature endpoints
    races/              # Race endpoints
    seasons/            # Season endpoints
lib/                    # Server-side libraries
  ergo/                 # Ergo blockchain integration (server.ts, types.ts)
  training-engine.ts    # Training validation + gain computation
src/                    # React frontend
  api/                  # API hooks (useCreatures, useRaces, useTraining, etc.)
  components/           # UI components (shadcn/ui based)
  context/              # WalletContext (Nautilus integration)
  pages/                # Route pages (Dashboard, Train, Races, Admin, etc.)
  lib/ergo/             # Client-side Ergo utilities
data/ergo/cyberpets/    # CyberPet NFT metadata JSON
migrations/             # Supabase SQL migrations
```

## CyberPets Trait Box (On-Chain Reference)

```
Box ID:    a9af56f8cae018dc69c36eeb3a89f7a17d306cf5f86203d60cc77a25444d90fe
TX ID:     c988253964cba60b9eea9110c400d545ea3bcb49ce8ad8e5842f1070da3da744
Root Hash: 25a513e4f2869fda20300c1e619d611f33e3d82eab53f05fc4f1b81b91c2a32b
Pets:      460
```

## License

AGPL-3.0 — see [LICENSE](LICENSE)
