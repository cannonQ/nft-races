# CyberPets Racing — Build Status & Roadmap

**Date:** 2026-02-07
**Phase:** 1 (DB + API — Build & Playtest)

---

## Current State

All backend API endpoints are built and all frontend hooks are wired to real API calls. Zero mock data remaining in the frontend.

### Infrastructure

| Component | Stack | Status |
|-----------|-------|--------|
| Frontend | Vite + React SPA (Lovable-generated) | Built, hooks wired |
| Backend | Vercel Serverless Functions (`api/`) | All 14 endpoints built |
| Database | Supabase (PostgreSQL) | Schema live, Season 1 created |
| Blockchain | Ergo (Explorer API for ownership verification) | Integrated |
| Wallet | Nautilus browser + ErgoAuth mobile | Lib built, not yet integrated in hooks |
| Deployment | Vercel (framework: vite) | Local dev tested, not yet deployed |

---

## API Endpoints — Complete Inventory

### Public GET Endpoints

| # | Endpoint | File | Purpose |
|---|----------|------|---------|
| 1 | `GET /api/v2/seasons/current` | `api/v2/seasons/current.ts` | Active season info + modifier |
| 2 | `GET /api/v2/creatures/by-wallet/:address` | `api/v2/creatures/by-wallet/[address].ts` | All creatures for a wallet (batch queries) |
| 3 | `GET /api/v2/creatures/:id` | `api/v2/creatures/[id]/index.ts` | Single creature with computed stats |
| 4 | `GET /api/v2/creatures/:id/training-log` | `api/v2/creatures/[id]/training-log.ts` | Training history (last 50) |
| 5 | `GET /api/v2/races` | `api/v2/races/index.ts` | Open + recently resolved races |
| 6 | `GET /api/v2/races/:id/results` | `api/v2/races/[id]/results.ts` | Race results with score breakdown |
| 7 | `GET /api/v2/leaderboard` | `api/v2/leaderboard.ts` | Season standings (optional `?season=`) |

### Public POST Endpoints (User Actions)

| # | Endpoint | File | Purpose |
|---|----------|------|---------|
| 8 | `POST /api/v2/creatures/register` | `api/v2/creatures/register.ts` | Register NFT — verifies on-chain ownership |
| 9 | `POST /api/v2/train` | `api/v2/train.ts` | Train creature — validates cooldowns, applies gains |
| 10 | `POST /api/v2/races/:id/enter` | `api/v2/races/[id]/enter.ts` | Enter race — snapshots stats, validates limits |

### Admin POST Endpoints (Bearer token auth)

| # | Endpoint | File | Purpose |
|---|----------|------|---------|
| 11 | `POST /api/v2/admin/seasons/start` | `api/v2/admin/seasons/start.ts` | Start new season, init creature stats |
| 12 | `POST /api/v2/admin/seasons/end` | `api/v2/admin/seasons/end.ts` | End season, compute payouts, update prestige |
| 13 | `POST /api/v2/admin/races/create` | `api/v2/admin/races/create.ts` | Create a new race |
| 14 | `POST /api/v2/admin/races/resolve` | `api/v2/admin/races/resolve.ts` | Resolve race — deterministic results from Ergo block hash |

### Utility Endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /api/health` | `api/health.ts` | Health check |
| `GET /api/v2/collections` | `api/v2/collections.ts` | List collections |

### Shared Server Libraries

| File | Purpose |
|------|---------|
| `api/_lib/supabase.ts` | Supabase service client |
| `api/_lib/auth.ts` | Admin `CRON_SECRET` bearer token guard |
| `api/_lib/helpers.ts` | `getActiveSeason()`, `computeCreatureResponse()`, `countActionsToday()` |
| `api/_lib/constants.ts` | Activity display map, reward labels, nanoErg conversion |
| `api/_lib/cyberpets.ts` | CyberPet JSON loader, trait parser, base stat computation |

### Frontend Hooks (all wired to real API)

| Hook | Endpoint | Type |
|------|----------|------|
| `useCurrentSeason` | `GET /api/v2/seasons/current` | Query |
| `useCreaturesByWallet` | `GET /api/v2/creatures/by-wallet/:addr` | Query |
| `useCreature` | `GET /api/v2/creatures/:id` | Query |
| `useTrainingLog` | `GET /api/v2/creatures/:id/training-log` | Query |
| `useRaces` | `GET /api/v2/races` | Query |
| `useRaceResults` | `GET /api/v2/races/:id/results` | Query |
| `useLeaderboard` | `GET /api/v2/leaderboard` | Query |
| `useRegisterCreature` | `POST /api/v2/creatures/register` | Mutation |
| `useTrain` | `POST /api/v2/train` | Mutation |
| `useEnterRace` | `POST /api/v2/races/:id/enter` | Mutation |

---

## Testing Plan

### Prerequisites

1. **Run migration** — Execute `migrations/003_add_boosted_column.sql` in Supabase SQL editor
2. **Seed `game_config`** — Insert the game config row (activities, race_type_weights, prize_distribution) from `PRE-architecture-sketch.md`
3. **Verify env vars** — Ensure `CRON_SECRET`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel dashboard and pulled to `.env.local`

### Step 1: Register Creatures

```bash
# Option A: Bulk register all 460 CyberPets via script
npx ts-node scripts/register-cyberpets.ts

# Option B: Register one at a time via API (verifies on-chain ownership)
# POST /api/v2/creatures/register { tokenId, walletAddress }
```

### Step 2: Verify GET Endpoints

```
GET /api/v2/seasons/current         → Season 1 data
GET /api/v2/creatures/by-wallet/9h... → Registered creatures for wallet
GET /api/v2/creatures/:id           → Single creature with computed fields
GET /api/v2/leaderboard             → [] (no races yet)
GET /api/v2/races                   → [] (no races yet)
```

### Step 3: Create a Race (Admin)

```bash
node -e "
fetch('http://localhost:3000/api/v2/admin/races/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <CRON_SECRET>'
  },
  body: JSON.stringify({
    name: 'Test Sprint',
    raceType: 'sprint',
    entryDeadline: new Date(Date.now() + 3600000).toISOString(),
    maxEntries: 8
  })
}).then(r => r.json()).then(console.log)
"
```

### Step 4: Train a Creature

```
POST /api/v2/train
{ creatureId, activity: "sprint_drills", walletAddress }
→ Returns stat changes, new fatigue/sharpness, actions remaining
```

### Step 5: Enter Race + Resolve

```
POST /api/v2/races/:id/enter
{ creatureId, walletAddress }
→ Stats snapshotted at entry time

POST /api/v2/admin/races/resolve    (Admin)
{ raceId }
→ Fetches Ergo block hash, computes deterministic results, updates leaderboard
```

### Step 6: Verify Results

```
GET /api/v2/races/:id/results  → Positions, scores, breakdowns
GET /api/v2/leaderboard        → Updated standings
GET /api/v2/creatures/:id      → Updated boost_multiplier / bonus_actions from rewards
```

---

## Deploy Checklist

1. [ ] Verify all env vars are set in Vercel dashboard
2. [ ] Run `migrations/003_add_boosted_column.sql` in Supabase
3. [ ] Seed `game_config` table with activity/race config
4. [ ] Run `npx ts-node scripts/register-cyberpets.ts` to bulk register creatures
5. [ ] Push to git → triggers Vercel deploy
6. [ ] Smoke test production endpoints
7. [ ] Connect Nautilus wallet in frontend and verify creature loading
8. [ ] Run a full loop: register → train → enter race → resolve → check results

---

## Phase 1 → Phase 2: On-Chain Migration Map

Every API endpoint and DB interaction maps to an on-chain equivalent. The formulas are identical — the difference is where they execute and who enforces the rules.

### Process Flow Comparison

```
PHASE 1 (Current — DB + API)
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Frontend  │───▶│  Vercel  │───▶│ Supabase │
│  (React)  │◀───│  API     │◀───│   (DB)   │
└──────────┘    └────┬─────┘    └──────────┘
                     │
                     ▼
              ┌──────────────┐
              │ Ergo Explorer│  (ownership check only)
              │     API      │
              └──────────────┘

PHASE 2 (Target — Smart Contracts)
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Frontend  │───▶│ TX Build │───▶│  Ergo    │
│  (React)  │◀───│  Service │◀───│  Chain   │
└──────────┘    └────┬─────┘    └────┬─────┘
                     │               │
                     ▼               ▼
              ┌──────────────┐  ┌──────────┐
              │  Supabase    │◀─│ Indexer   │  (read cache only)
              │  (read cache)│  │ (scanner) │
              └──────────────┘  └──────────┘
```

### Endpoint → Contract Mapping

| Phase 1 Endpoint | Phase 2 Equivalent | What Changes |
|------------------|--------------------|--------------|
| **POST /creatures/register** | **No contract needed** — NFT ownership is native. Creature exists if the wallet holds the token. Base stats derived from on-chain metadata (packed-data box). | DB insert → AVL tree insert (first training TX auto-registers) |
| **POST /train** | **Training Contract** — User builds TX: sends 0.01 ERG to pool box + AVL proof of stat update. Contract validates: cooldown (`HEIGHT >= lastAction + 360`), diminishing returns formula, fatigue cost, stat caps. | Server validation → ErgoScript validation. Same formulas. |
| **POST /races/:id/enter** | **Race Entry Contract** — User builds TX: sends 0.05 ERG to race box + snapshot stats from AVL read. Contract validates: ownership, cooldown, race not full. | Snapshot stored in race box registers instead of DB. |
| **POST /admin/races/resolve** | **Race Resolution Contract** — Anyone can trigger (no admin needed). Contract reads `CONTEXT.headers(0).id` for block hash RNG seed. Computes scores identically. Distributes payouts from race box automatically. | Admin trigger → permissionless. Payouts are TX outputs, not DB entries. |
| **POST /admin/seasons/start** | **Season Contract** — New season box created with: AVL tree digest (all stats zeroed), prize pool = 0, end height. | Admin action → scheduled or governance vote. |
| **POST /admin/seasons/end** | **Season Payout Contract** — Triggered when `HEIGHT >= season_end_height`. Reads leaderboard from AVL tree. Creates payout output boxes (40%/35%/25% split). | Admin trigger → automated by block height. |
| **GET /seasons/current** | **TX Builder reads season box** from chain. Indexed in DB for fast frontend reads. | API reads DB → API reads chain-synced DB. |
| **GET /creatures/by-wallet/:addr** | **TX Builder queries AVL tree** with wallet's token IDs. Indexed in DB. | Same API, data source changes from "source of truth" to "indexed mirror." |
| **GET /leaderboard** | **Leaderboard AVL tree** (separate tree or same tree extended). Indexed in DB. | Same shape, indexed from chain. |
| **GET /races/:id/results** | **Race box registers** contain results after resolution. Indexed in DB. | Same shape, data pulled from resolved race box. |

### What Moves On-Chain vs. Stays Off-Chain

| Component | Phase 1 | Phase 2 | Notes |
|-----------|---------|---------|-------|
| **Stat storage** | `creature_stats` table | AVL tree (26 bytes/creature) in state box register | Digest stored on-chain; full tree in off-chain service for proof generation |
| **Training validation** | `validateTrainingAction()` in API | ErgoScript in Training Contract | Identical rules: cooldown, daily limits, stat caps |
| **Stat gain computation** | `computeTrainingGains()` in API | ErgoScript arithmetic | Same formula: `gain = base × (1 - current/80)` |
| **Condition decay** | `applyConditionDecay()` computed at read time | Computed at TX time from `HEIGHT - lastActionHeight` | Block height replaces wall-clock time |
| **Race scoring** | `computeRaceResult()` in API | ErgoScript in Resolution Contract | Same formula, `CONTEXT.headers` replaces Explorer API for block hash |
| **RNG** | `sha256(blockHash + creatureId)` → seedrandom | `blake2b256(raceBoxId ++ headers(0).id ++ tokenId)` modular arithmetic | Deterministic and verifiable in both phases |
| **Prize distribution** | DB ledger → admin payout | SC creates output boxes automatically | Trustless, no admin needed |
| **Cooldowns** | `last_action_at` timestamps | `HEIGHT >= lastHeight + N` (360 blocks ≈ 12h) | Block height is more reliable than timestamps |
| **Fee collection** | API constructs TX | User TX includes fee output natively | Self-enforcing via contract |
| **Auth** | Wallet signature → API verifies | TX signature = auth (native to UTXO model) | No separate auth layer needed |
| **Leaderboard** | `season_leaderboard` table | Separate AVL tree or extended creature tree | Indexed off-chain for fast reads |
| **Training log** | `training_log` table | On-chain TX history | Indexed by scanner for frontend display |

### Key Technical Decisions for Phase 2

**AVL Tree (recommended over per-creature boxes):**
- Single state box holds digest of entire creature tree
- Race resolution reads all entrants from one tree (efficient)
- Off-chain service generates AVL proofs for each TX
- Already have AVL experience from oracle pool work

**Off-chain services that persist:**
- **TX Builder** — constructs training/race TXs with AVL proofs for Nautilus signing
- **Indexer** — watches chain, mirrors to Supabase for fast API reads
- **Frontend** — identical React app, same API shape, data source shifts to chain-synced DB
- **Race Scheduler** — creates race boxes on schedule (could also be on-chain with height-based triggers)

### Migration Steps

| Step | Action | Timing |
|------|--------|--------|
| 1 | Launch Phase 1, start playtesting | Now |
| 2 | Gather balance data from ~100 races | 2-4 weeks |
| 3 | Finalize constants (stat gains, fatigue curves, prize splits) | After data analysis |
| 4 | Write ErgoScript contracts (Training, Race Entry, Resolution, Season Payout) | 2-3 weeks |
| 5 | Build TX Builder service with AVL proof generation | 1-2 weeks |
| 6 | Deploy to Ergo testnet, run parallel with DB version | 1-2 weeks testing |
| 7 | Deploy to mainnet — DB becomes read-only indexer | Production launch |
| 8 | Open-source frontend + TX builder | Post-launch |

---

## Files Changed This Session

### New Files
- `api/v2/train.ts` — Training action endpoint
- `api/v2/admin/races/resolve.ts` — Race resolution endpoint
- `api/v2/creatures/register.ts` — Creature registration endpoint
- `api/_lib/cyberpets.ts` — CyberPet data loader for serverless

### Modified Files
- `src/api/useCurrentSeason.ts` — Wired to real API (mock removed)
- `src/api/useCreatures.ts` — All 3 hooks wired to real API (mock removed)
- `src/api/useTraining.ts` — Both hooks wired to real API (mock removed)
- `src/api/useRaces.ts` — All 3 hooks wired to real API (mock removed)
- `src/api/useLeaderboard.ts` — Wired to real API (mock removed)
- `api/_lib/auth.ts` — Debug logging removed
