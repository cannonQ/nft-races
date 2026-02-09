# CyberPets Racing — Build Status & Roadmap

**Date:** 2026-02-09
**Phase:** 1 (DB + API — Alpha Testing)

---

## Current State

Full game loop is operational: wallet connect → auto-discover CyberPets → train → enter races → view results. All 14 API endpoints built, all frontend hooks wired, admin page for race management.

### What Works
- Nautilus wallet connect/disconnect with auto-reconnect
- **Auto-discovery**: CyberPets in wallet are detected on-chain and auto-registered to DB (no manual registration needed)
- Dashboard displays owned CyberPets with NFT images, stale ownership auto-cleaned
- Training calls real API: stat gains, diminishing returns, actions counter (2/day), cooldown enforcement
- Race entry calls real API with on-chain ownership verification
- Race results, leaderboard, creature profile pages functional
- Admin page (`/admin`) for creating and resolving races
- On-chain NFT ownership verification on all mutation endpoints (train, race entry)

### Open Items
- [ ] **Training cost (0.01 ERG)** — Architecture defines 10,000,000 nanoErg per training. Not yet implemented. Requires treasury address. When added, Nautilus `sign_tx()` will show ERG amount (better UX than current no-cost flow).
- [ ] **Race entry fee** — Same pattern as training cost. Entry fee stored in `season_races.entry_fee_nanoerg`.
- [ ] **Vercel deployment** — Push to deploy. Env vars should already be set.

### Infrastructure

| Component | Stack | Status |
|-----------|-------|--------|
| Frontend | Vite + React SPA | All pages + admin page |
| Backend | Vercel Serverless Functions (`api/`) | All 14 endpoints + admin |
| Database | Supabase (PostgreSQL) | Schema live, Season 1 created |
| Blockchain | Ergo (Explorer API for ownership verification) | Integrated — single-call balance fetch |
| Wallet | Nautilus (EIP-12 dApp connector) | Connect, address, balance |
| Auth | On-chain NFT ownership via Explorer API | No wallet signing in Phase 1; native UTXO auth in Phase 2 |
| Verification | ergo-lib-wasm-nodejs (server-side) | Available for future signing needs |
| Deployment | Vercel (framework: vite) | Local dev tested |

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
| `api/_lib/register-creature.ts` | Shared creature registration (used by register endpoint + auto-discovery) |

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

## Alpha Testing Plan

### Prerequisites

1. **Run migration** — Execute `migrations/003_add_boosted_column.sql` in Supabase SQL editor
2. **Seed `game_config`** — Insert the game config row (activities, race_type_weights, prize_distribution) from `PRE-architecture-sketch.md`
3. **Verify env vars** — `CRON_SECRET`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel dashboard / `.env.local`

### Step 1: Connect Wallet & Discover Creatures

Connect Nautilus wallet. The `by-wallet` endpoint auto-discovers CyberPets on-chain:
- Fetches full wallet balance from Explorer API (single call)
- Filters to CyberPets using `isCyberPet()` + `cyber_pet_traits.json`
- Auto-registers any missing creatures (inserts creature + stats + prestige)
- Re-claims creatures with stale/null ownership
- Clears creatures transferred to other wallets

No manual registration needed.

### Step 2: Train a Creature

From Training page: select creature → pick activity → confirm → real API call.
- 2 actions/day + cooldown enforced
- Stat gains with diminishing returns
- Actions counter decrements in real-time

### Step 3: Create a Race (Admin)

Navigate to `/admin` → authenticate → Create Race form.
Or via CLI: `npx ts-node scripts/create-race.ts --name "Sprint #1" --type sprint --deadline 60`

### Step 4: Enter Race

From Races page: select open race → pick creature → confirm entry.
On-chain ownership re-verified at entry time.

### Step 5: Resolve Race (Admin)

From `/admin` → click "Resolve" on an open race.
Or via CLI: `npx ts-node scripts/resolve-races.ts`
Results computed deterministically from Ergo block hash.

### Step 6: Verify Results

Race results page, leaderboard, creature profile all update with race outcomes.
Reward boosts (bonus actions, boost multiplier) applied to winners.

---

## Deploy Checklist

1. [ ] Verify all env vars are set in Vercel dashboard
2. [ ] Run `migrations/003_add_boosted_column.sql` in Supabase
3. [ ] Seed `game_config` table with activity/race config
4. [ ] Push to git → triggers Vercel deploy
5. [ ] Smoke test: connect wallet → creatures auto-discovered
6. [ ] Full loop: train → create race (admin) → enter race → resolve → check results

---

## Chain Interaction Reference (Phase 1 → Phase 2 SC Scoping)

### What Touches the Chain NOW (Phase 1)

| Action | Chain Interaction | How |
|--------|-------------------|-----|
| **Wallet connect** | Read wallet address | `ergo.get_change_address()` via Nautilus EIP-12 |
| **Creature discovery** | Read all tokens in wallet | `GET /addresses/{addr}/balance/confirmed` — Explorer API (1 call per wallet load) |
| **Ownership verification** | Same balance endpoint | Checked on every train, race entry, and wallet load |
| **Race resolution RNG** | Read latest block hash | `GET /blocks?limit=1` — Explorer API. Used as seed for deterministic scoring. |

### What Is DB-Only NOW (Moves On-Chain in Phase 2)

| Component | Phase 1 (DB) | Phase 2 (On-Chain) |
|-----------|-------------|-------------------|
| **Training state** (stats, fatigue, sharpness) | `creature_stats` table | AVL tree in state box register |
| **Training action** | API validates + DB update | User TX: 0.01 ERG fee + AVL proof → Training Contract validates |
| **Training log** | `training_log` table | On-chain TX history, indexed by scanner |
| **Race entry** | API validates + DB insert | User TX: entry fee to race box + snapshot stats |
| **Race resolution** | Admin calls API → DB update | Permissionless: anyone triggers → Contract reads `CONTEXT.headers(0).id` |
| **Prize distribution** | DB ledger (manual payout) | Contract auto-creates payout output boxes |
| **Leaderboard** | `season_leaderboard` table | AVL tree or extended creature tree |
| **Cooldowns** | `last_action_at` timestamps | `HEIGHT >= lastHeight + N` blocks |
| **Fee collection** | Not yet implemented | User TX includes fee output natively |

### Phase 2 Vision: Everything On-Chain, DB = Read Cache

In Phase 2, the Ergo blockchain is the **source of truth** for all game state. The DB becomes a read-only index (mirror) for fast frontend queries. The chain enforces all rules (cooldowns, stat caps, fee collection, prize distribution) via ErgoScript contracts. No admin needed for race resolution or season payouts.

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

## Alpha-Ready Changes (2026-02-09)

### Bug Fixes
- `api/v2/train.ts` — Fixed training_log insert: `fatigue_delta` → `fatigue_change` (column name mismatch caused silent insert failure → actions counter stuck at 2/2). Made insert fatal.
- `src/data/trainingActivities.ts` — Fixed activity ID mismatch (`train_sprint` → `sprint_drills`, etc.) that caused 500 errors
- `api/v2/train.ts` — Added on-chain NFT ownership verification (prevents training stale creatures)

### Race Entry Wiring
- `src/pages/Races.tsx` — Wired `handleConfirmEntry` to real `useEnterRace()` API call (was a toast-only stub)
- `src/api/useRaces.ts` — Removed unnecessary wallet signing from `useEnterRace`
- `api/v2/races/[id]/enter.ts` — Added on-chain NFT ownership verification

### Auto-Registration (Eliminates Manual Registration)
- `api/v2/creatures/by-wallet/[address].ts` — Rewritten: single Explorer API call, auto-discovers CyberPets on-chain, auto-registers missing ones, re-claims creatures with stale ownership, clears transferred-away creatures
- `api/_lib/register-creature.ts` — **NEW**: Shared registration helper extracted from register.ts
- `api/v2/creatures/register.ts` — Refactored to use shared helper
- `lib/ergo/server.ts` — Exported `fetchAddressBalanceWithFallback` for by-wallet auto-discovery
- `src/pages/Dashboard.tsx` — Removed dead "Register Your NFT" button, updated empty state messaging

### Admin Page
- `src/pages/Admin.tsx` — **NEW**: Admin dashboard with auth gate, create race form, open races with resolve buttons, recent results
- `src/App.tsx` — Added `/admin` route (hidden, not in nav)

### Signing Removal (Phase 1)
- `src/api/useTraining.ts` — Removed `createAuthHeaders`/`sign_data` call (server does on-chain verification, no wallet popup needed)
- `src/api/useRaces.ts` — Same removal for race entry

### NFT Images + Training
- `api/_lib/helpers.ts` — Added `imageUrl` to `computeCreatureResponse()`
- `src/components/creatures/CreatureHeader.tsx`, `CreatureTrainHeader.tsx`, `CreatureCard.tsx` — NFT image display
- `src/pages/Train.tsx` — Wired `useTrain()` hook, real API calls, loading/error states, creature images in selection

---

## Wallet Integration (2026-02-08)

### New Files
- `src/lib/ergo/types.ts` — ErgoConnector, ErgoAPI, transaction types, Window augmentation
- `src/lib/ergo/client.ts` — Nautilus connection, address, balance, signing (EIP-12)
- `src/lib/ergo/transactions.ts` — TX building for entry fees (from Field patterns)
- `src/lib/ergo/auth.ts` — Signed auth headers (CYBERPETS:{action}:{address}:{timestamp})
- `src/lib/ergo/index.ts` — Barrel export

### Rewritten Files
- `src/context/WalletContext.tsx` — Real Nautilus integration (was mocked)
- `src/components/layout/WalletConnect.tsx` — 4-state UI (install/connecting/connected/error)
- `src/ergo-verify.ts` — Real signature verification via ergo-lib-wasm-nodejs

### Modified Files
- `src/api/useTraining.ts` — Auth headers added to useTrain mutation
- `src/api/useRaces.ts` — Auth headers added to useEnterRace mutation
- `src/api/useCreatures.ts` — Auth headers added to useRegisterCreature mutation
- `package.json` — Added @nautilus-js/eip12-types

### Bug Fixes (2026-02-08)
- `src/components/races/RaceHeader.tsx` — Fixed crash on null completedAt date
- `api/v2/races/[id]/results.ts` — Fallback when race.updated_at is null
- `src/components/creatures/CreatureHeader.tsx` — Fallback for unknown rarity values
- `src/components/creatures/StatBar.tsx` — Fallback for unknown rarity in RarityBadge

---

## Files Changed (Previous Session — 2026-02-07)

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
