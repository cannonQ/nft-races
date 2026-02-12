# CyberPets Racing — Build Status & Roadmap

**Date:** 2026-02-12
**Phase:** 1 (DB + API — Launch Day)

---

## Current State

Full game loop is operational: wallet connect → auto-discover CyberPets → train → enter races → view results. All 22 API endpoints built, all frontend hooks wired, admin page for race management. Races auto-resolve when their deadline passes (lazy resolution on page load). FAQ page explains all game mechanics. Currently in multi-user alpha testing.

### What Works
- Nautilus wallet connect/disconnect with auto-reconnect
- **Auto-discovery**: CyberPets in wallet are detected on-chain and auto-registered to DB (no manual registration needed)
- Dashboard displays owned CyberPets with NFT images, stale ownership auto-cleaned
- Training calls real API: stat gains, diminishing returns, actions counter (2/day), cooldown enforcement
- Discrete boost rewards: earned from races, selectable at training time, block-height expiry
- Race entry calls real API with on-chain ownership verification
- Race results with full score breakdown (stat contributions, modifiers, luck)
- Leaderboard, creature profile, race history pages functional
- Admin page (`/admin`) for creating, editing, resolving, and reopening races
- **Auto-resolve**: Expired races resolve lazily on next page load (per-race `auto_resolve` flag, default true)
- Cancelled races visible in admin with reopen capability
- Resolve confirmation dialog prevents accidental race cancellation
- On-chain NFT ownership verification on all mutation endpoints (train, race entry)
- FAQ page with comprehensive game mechanics guide
- **ErgoPay mobile wallet** — QR code / deep-link connect flow for mobile users (Nautilus + ErgoPay dual support)
- **Credit ledger (shadow billing)** — Tracks theoretical training fees, race entry fees, and payouts per wallet (preparation for Phase 2 on-chain fees)
- **Image caching proxy** — Pet images served via `/api/v2/img/[number]` with Vercel CDN edge caching (1yr immutable), fallback to cyberversewiki.com

### Open Items
- [ ] **Training cost (0.01 ERG)** — Architecture defines 10,000,000 nanoErg per training. Shadow-tracked in credit ledger. On-chain enforcement deferred to Phase 2 (requires treasury address + Nautilus `sign_tx()`).
- [ ] **Race entry fee** — Same pattern as training cost. Entry fee stored in `season_races.entry_fee_nanoerg`. Shadow-tracked in credit ledger.
- [ ] **Vercel deployment** — Push to deploy. Env vars should already be set.

### Infrastructure

| Component | Stack | Status |
|-----------|-------|--------|
| Frontend | Vite + React SPA | All pages + admin page |
| Backend | Vercel Serverless Functions (`api/`) | All 14 endpoints + admin |
| Database | Supabase (PostgreSQL) | Schema live, Season 1 created |
| Blockchain | Ergo (Explorer API for ownership verification) | Integrated — single-call balance fetch |
| Wallet | Nautilus (EIP-12) + ErgoPay (EIP-20) | Desktop + mobile wallet connect |
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
| 5 | `GET /api/v2/races` | `api/v2/races/index.ts` | Open + recently resolved races (auto-resolves expired races) |
| 6 | `GET /api/v2/races/:id/results` | `api/v2/races/[id]/results.ts` | Race results with score breakdown |
| 7 | `GET /api/v2/leaderboard` | `api/v2/leaderboard.ts` | Season standings (optional `?season=`) |
| 8 | `GET /api/v2/config` | `api/v2/config.ts` | Public game config (activities, race type weights) |
| 9 | `GET /api/v2/creatures/:id/race-history` | `api/v2/creatures/[id]/race-history.ts` | Race entries for a creature |
| 10 | `GET /api/v2/wallet/:address/ledger` | `api/v2/wallet/[address]/ledger.ts` | Credit ledger (fees, payouts, balance) |
| 11 | `GET /api/v2/ergopay/status/:sessionId` | `api/v2/ergopay/status/[sessionId].ts` | Poll ErgoPay session status |
| 12 | `GET /api/v2/img/:number` | `api/v2/img/[number].ts` | Image caching proxy (ergexplorer → cyberversewiki fallback, 1yr CDN cache) |

### Public POST Endpoints (User Actions)

| # | Endpoint | File | Purpose |
|---|----------|------|---------|
| 10 | `POST /api/v2/creatures/register` | `api/v2/creatures/register.ts` | Register NFT — verifies on-chain ownership |
| 11 | `POST /api/v2/train` | `api/v2/train.ts` | Train creature — validates cooldowns, applies gains |
| 12 | `POST /api/v2/races/:id/enter` | `api/v2/races/[id]/enter.ts` | Enter race — snapshots stats, validates limits |
| 13 | `POST /api/v2/ergopay/init` | `api/v2/ergopay/init.ts` | Create ErgoPay session, return ergopay:// URL |

### Admin POST Endpoints (Bearer token auth)

| # | Endpoint | File | Purpose |
|---|----------|------|---------|
| 14 | `POST /api/v2/admin/seasons/start` | `api/v2/admin/seasons/start.ts` | Start new season, init creature stats |
| 15 | `POST /api/v2/admin/seasons/end` | `api/v2/admin/seasons/end.ts` | End season, compute payouts, update prestige |
| 16 | `POST /api/v2/admin/races/create` | `api/v2/admin/races/create.ts` | Create a new race |
| 17 | `POST /api/v2/admin/races/resolve` | `api/v2/admin/races/resolve.ts` | Resolve race — deterministic results from Ergo block hash |
| 18 | `POST /api/v2/admin/races/update` | `api/v2/admin/races/update.ts` | Edit open race (name, type, deadline, max entries) |
| 19 | `POST /api/v2/admin/races/reopen` | `api/v2/admin/races/reopen.ts` | Reopen cancelled race (sets status back to open) |

### Utility Endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /api/health` | `api/health.ts` | Health check |
| `GET /api/v2/collections` | `api/v2/collections.ts` | List collections |
| `GET /api/v2/ergopay/connect/:sessionId/:address` | `api/v2/ergopay/connect/[sessionId]/[address].ts` | ErgoPay wallet callback (called by mobile wallet) |

### Shared Server Libraries

| File | Purpose |
|------|---------|
| `api/_lib/supabase.ts` | Supabase service client |
| `api/_lib/auth.ts` | Admin `CRON_SECRET` bearer token guard |
| `api/_lib/helpers.ts` | `getActiveSeason()`, `getLatestErgoBlock()`, `computeCreatureResponse()`, `countRegularActionsToday()` |
| `api/_lib/constants.ts` | Activity display map, reward labels, nanoErg conversion |
| `api/_lib/cyberpets.ts` | CyberPet JSON loader, trait parser, base stat computation |
| `api/_lib/register-creature.ts` | Shared creature registration (used by register endpoint + auto-discovery) |
| `api/_lib/resolve-race.ts` | Shared race resolution logic (used by admin endpoint + auto-resolve in GET /races) |
| `api/_lib/credit-ledger.ts` | Credit ledger helper — records training fees, race fees, payouts |

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
| `useGameConfig` | `GET /api/v2/config` | Query |
| `useRaceHistory` | `GET /api/v2/creatures/:id/race-history` | Query |
| `useWalletLedger` | `GET /api/v2/wallet/:address/ledger` | Query |

---

## Alpha Testing Plan

The basic game loop (wallet → discover → train → race → results) is confirmed working with multiple testers. The focus now is edge-case testing, multi-user scenarios, and balance tuning.

### Completed (Verified Working)
- [x] Wallet connect + auto-discover CyberPets
- [x] Training with stat gains + diminishing returns
- [x] Admin: create race, edit race, resolve race
- [x] Race entry with ownership verification
- [x] Race results with score breakdown
- [x] Leaderboard updates after race resolution
- [x] Boost rewards awarded from race results
- [x] FAQ page with game mechanics
- [x] Cancelled races visible in admin + reopen functionality
- [x] Resolve confirmation dialog (prevents accidental cancellation)

### Testing Checklist — Multi-User & Edge Cases

#### Wallet & Creature Discovery
- [x] Two wallets with different CyberPets see only their own creatures
- [x] Transferring a CyberPet NFT to another wallet: old wallet loses it, new wallet gains it on next load
- [x] Wallet with no CyberPets shows empty state (no errors)
- [x] Disconnect and reconnect wallet — creatures reload correctly
- [x] Wallet with many NFTs (non-CyberPets) loads without delay

#### Training
- [x] Train 2 times — actions counter shows 0/2 remaining
- [x] 3rd training attempt is blocked with clear message -- not sure message was clear that only 2 per day, UTC reset daily
- [x] Cooldown timer displays and counts down correctly after training
- [x] Training after cooldown expires works as expected
- [x] Projected gains in confirm modal match actual results
- [x] Training with boost rewards selected — gains are multiplied correctly
- [x] Boost reward expiry — expired boosts not selectable
- [x] Training with `ALPHA_TESTING = true` — cooldown/daily limits bypassed

#### Race Entry
- [x] Enter a race with a valid creature — success toast + entry count increments
- [x] Try to enter same creature twice in same race — blocked
- [x] Try to enter a creature you no longer own (transferred) — blocked with ownership error
- [x] Race at max entries — new entry attempts blocked
- [x] Race past deadline — entry attempts blocked
- [x] Multiple users enter the same race — all entries appear

#### Race Management (Admin)
- [x] Create race with different types (sprint, distance, technical, mixed, hazard)
- [x] Edit open race: change name, type, deadline, max entries — verify updates
- [x] Edit deadline to extend time — users can still enter
- [x] Resolve race with 2+ entries — results computed, leaderboard updated
- [x] Resolve race with <2 entries — cancelled with reason shown
- [x] Cancelled race appears in "Cancelled Races" section
- [x] Reopen cancelled race — moves back to "Open Races" with new deadline
- [x] Reopen race → users can enter → resolve successfully
- [x] Confirm dialog on resolve — clicking "No" cancels the action

#### Race Results & Rewards
- [x] Results page shows all participants with positions and scores
- [x] Score breakdown: stat contributions, fatigue/sharpness modifiers, luck factor
- [x] 1st place receives +1 bonus action on creature_stats
- [x] 2nd place receives +50% discrete boost reward
- [x] 3rd place receives +25% discrete boost reward
- [x] 4th+ receives +10% discrete boost reward
- [x] Boosts show in creature profile and training confirm modal
- [x] Bonus action consumed before regular actions
- [x] Leaderboard: wins/places/shows counters update correctly

#### Cross-Feature & Stress Tests
- [x] Full loop: train creature → enter race → resolve → check results → use boost reward → train again
- [x] Two users racing against each other — different results based on stats
- [x] Race results deterministic — same block hash always produces same outcome
- [x] Multiple races created and resolved in sequence — no state leakage
- [x] Creature profile race history shows all past races
- [x] Training log shows all past training sessions with correct details

### Balance & Tuning (Collect Data)
- [ ] Are diminishing returns too aggressive or too lenient?
- [ ] Is 2 actions/day + 6h cooldown the right pace?
- [x] Do boost rewards feel impactful enough?
- [ ] Is the fatigue/sharpness system clear to players?
- [ ] Are race type weights producing interesting variety?
- [ ] Is the Focus/luck swing too swingy or not enough?
- [ ] Do prize splits (50/30/20) feel fair?

---

## Deploy Checklist

1. [x] Verify all env vars are set in Vercel dashboard
2. [x] Run migrations (003 through 006) in Supabase SQL editor
3. [x] Seed `game_config` table with activity/race config
4. [x] Push to git → triggers Vercel deploy
5. [x] Smoke test: connect wallet → creatures auto-discovered
6. [x] Full loop: train → create race (admin) → enter race → resolve → check results
7. [ ] Multi-user test: two different wallets complete full loop concurrently

---

## Chain Interaction Reference (Phase 1 → Phase 2 SC Scoping)

### What Touches the Chain NOW (Phase 1)

| Action | Chain Interaction | How |
|--------|-------------------|-----|
| **Wallet connect** | Read wallet address | `ergo.get_change_address()` via Nautilus EIP-12 |
| **Creature discovery** | Read all tokens in wallet | `GET /addresses/{addr}/balance/confirmed` — Explorer API (1 call per wallet load) |
| **Ownership verification** | Same balance endpoint | Checked on every train, race entry, and wallet load |
| **Race resolution RNG** | Read latest block hash + height | `GET /blocks?limit=1` — Explorer API. Hash = RNG seed, height = boost expiry reference |
| **Boost expiry** | Read current block height | Same blocks endpoint. Used to filter expired boosts and validate at training time |

### What Is DB-Only NOW (Moves On-Chain in Phase 2)

| Component | Phase 1 (DB) | Phase 2 (On-Chain) |
|-----------|-------------|-------------------|
| **Training state** (stats, fatigue, sharpness) | `creature_stats` table | AVL tree in state box register |
| **Training action** | API validates + DB update | User TX: 0.01 ERG fee + AVL proof → Training Contract validates |
| **Training log** | `training_log` table | On-chain TX history, indexed by scanner |
| **Boost rewards** | `boost_rewards` table (UTXO-style rows, block height expiry) | Actual Ergo boxes (reward tokens) sent to NFT owner, consumed as TX inputs |
| **Race entry** | API validates + DB insert | User TX: entry fee to race box + snapshot stats |
| **Race resolution** | Admin calls API → DB update | Permissionless: anyone triggers → Contract reads `CONTEXT.headers(0).id` |
| **Prize distribution** | DB ledger (manual payout) | Contract auto-creates payout output boxes |
| **Leaderboard** | `season_leaderboard` table | AVL tree or extended creature tree |
| **Cooldowns** | `last_action_at` timestamps (6h / 180 blocks) | `HEIGHT >= lastHeight + 180` blocks |
| **Fee collection** | Shadow-tracked in `credit_ledger` (no ERG moves yet) | User TX includes fee output natively |

### Phase 2 Vision: Everything On-Chain, DB = Read Cache

In Phase 2, the Ergo blockchain is the **source of truth** for all game state. The DB becomes a read-only index (mirror) for fast frontend queries. The chain enforces all rules (cooldowns, stat caps, fee collection, prize distribution) via ErgoScript contracts. No admin needed for race resolution or season payouts.

### Current Game Constants (Phase 1 — as implemented)

These are the actual values enforced in the working codebase. Subject to tuning from alpha playtesting.

| Constant | Value | Source |
|----------|-------|--------|
| **Per-stat cap** | 80 | `PER_STAT_CAP` in `training-engine.ts` |
| **Total stat cap** | 300 (sum of all 6 stats) | `TOTAL_STAT_CAP` in `training-engine.ts` |
| **Diminishing returns** | `gain = base_gain × (1 - current_stat / 80)` | `computeTrainingGains()` |
| **Regular actions/day** | 2 | `BASE_ACTIONS` in `training-engine.ts`, `helpers.ts`, `train.ts` |
| **Cooldown** | 6 hours (≈180 blocks at 720 blocks/day) | `COOLDOWN_HOURS = 6` |
| **Bonus actions** | Bypass cooldown + daily limit, consumed first | `validateTrainingAction()` |
| **Boost expiry** | 2160 blocks (~3 days) | `BOOST_EXPIRY_BLOCKS` in `training-engine.ts` |
| **Fatigue decay** | -3 per 24h (prorated), floor 0 | `applyConditionDecay()` |
| **Sharpness decay** | No decay 0–24h, -10/day after 24h | `applyConditionDecay()` |
| **Fatigue race modifier** | `1.0 - fatigue/200` → range [0.50, 1.00] | `computeRaceResult()` |
| **Sharpness race modifier** | `0.90 + sharpness/1000` → range [0.90, 1.00] | `computeRaceResult()` |
| **Focus RNG swing** | `0.30 × (1 - focus/(80 + baseFocus))` | `computeRaceResult()` |
| **RNG seed** | `sha256(blockHash + creatureId)` → seedrandom → [-1, 1] | `seedToFloat()` |
| **Final race score** | `weighted × fatigueMod × sharpnessMod × (1 + rngMod)` | `computeRaceResult()` |
| **Race prize split** | 50% / 30% / 20% (configurable via `game_config`) | `prize_distribution` default |
| **Race rewards** | 1st: +1 bonus action, 2nd: +50% boost, 3rd: +25% boost, 4th+: +10% boost | `getRaceRewardBoost()` |
| **Training cost** | 0.01 ERG (shadow-tracked in credit ledger, not yet on-chain) | `TRAINING_FEE_NANOERG` in `constants.ts` |
| **Race entry fee** | Configurable per-race (`entry_fee_nanoerg` column) | `season_races` table |
| **Alpha testing mode** | `ALPHA_TESTING = true` — cooldown and daily limits disabled | `validateTrainingAction()` |

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
| **POST /train** | **Training Contract** — User builds TX: sends 0.01 ERG to pool box + AVL proof of stat update + optional boost reward box inputs. Contract validates: cooldown (`HEIGHT >= lastAction + 180`), 2 actions/day limit, diminishing returns (`gain = base × (1 - current/80)`), per-stat cap (80), total cap (300), fatigue cost. Boost reward inputs consumed in same TX. | Server validation → ErgoScript validation. Same formulas. |
| **POST /races/:id/enter** | **Race Entry Contract** — User builds TX: sends entry fee to race box + snapshot stats from AVL read. Contract validates: ownership, not already entered, race not full. | Snapshot stored in race box registers instead of DB. |
| **POST /admin/races/resolve** | **Race Resolution Contract** — Anyone can trigger (no admin needed). Contract reads `CONTEXT.headers(0).id` for block hash RNG seed. Computes scores identically. Creates boost reward output boxes for 2nd–4th+ and bonus action marker for 1st. Distributes prize pool (50/30/20 split). | Phase 1: lazy auto-resolve on page load (wall-clock time). Phase 2: permissionless, block-height trigger. Payouts + boost rewards are TX outputs, not DB entries. |
| **POST /admin/seasons/start** | **Season Contract** — New season box created with: AVL tree digest (all stats zeroed), prize pool = 0, end height. | Admin action → scheduled or governance vote. |
| **POST /admin/seasons/end** | **Season Payout Contract** — Triggered when `HEIGHT >= season_end_height`. Reads leaderboard from AVL tree. Creates payout output boxes. | Admin trigger → automated by block height. |
| **GET /seasons/current** | **TX Builder reads season box** from chain. Indexed in DB for fast frontend reads. | API reads DB → API reads chain-synced DB. |
| **GET /creatures/by-wallet/:addr** | **TX Builder queries AVL tree** with wallet's token IDs. Indexed in DB. | Same API, data source changes from "source of truth" to "indexed mirror." |
| **GET /leaderboard** | **Leaderboard AVL tree** (separate tree or same tree extended). Indexed in DB. | Same shape, indexed from chain. |
| **GET /races/:id/results** | **Race box registers** contain results after resolution. Indexed in DB. | Same shape, data pulled from resolved race box. |

### What Moves On-Chain vs. Stays Off-Chain

| Component | Phase 1 | Phase 2 | Notes |
|-----------|---------|---------|-------|
| **Stat storage** | `creature_stats` table (6 stats + fatigue + sharpness + counters) | AVL tree in state box register | Digest stored on-chain; full tree in off-chain service for proof generation |
| **Training validation** | `validateTrainingAction()` in API | ErgoScript in Training Contract | Rules: 6h cooldown (180 blocks), 2 regular actions/day, bonus actions bypass both, per-stat cap 80, total cap 300 |
| **Stat gain computation** | `computeTrainingGains()` in API | ErgoScript arithmetic | Diminishing returns: `gain = base × (1 - current/80)`. Boost: `gain × (1 + totalBoostMultiplier)` |
| **Condition decay** | `applyConditionDecay()` computed at read time | Computed at TX time from `HEIGHT - lastActionHeight` | Fatigue: -3/24h prorated. Sharpness: no decay 0-24h, -10/day after 24h |
| **Race scoring** | `computeRaceResult()` in API | ErgoScript in Resolution Contract | `finalScore = weighted × fatigueMod × sharpnessMod × (1 + rngMod)` |
| **RNG** | `sha256(blockHash + creatureId)` → seedrandom | `blake2b256(raceBoxId ++ headers(0).id ++ tokenId)` modular arithmetic | Deterministic and verifiable in both phases |
| **Race modifiers** | fatigueMod = `1 - fatigue/200`, sharpnessMod = `0.90 + sharpness/1000`, focusSwing = `0.30 × (1 - focus/(80+baseFocus))` | Same formulas in ErgoScript | fatigueMod range [0.50, 1.00], sharpnessMod range [0.90, 1.00] |
| **Prize distribution** | Race prizes: 50/30/20% of entry pool (from `game_config`) | SC creates output boxes automatically | Configurable per-race via `game_config.prize_distribution` |
| **Boost rewards** | `boost_rewards` table — discrete rows with block height expiry (2160 blocks ≈ 3 days) | Actual Ergo boxes (reward tokens) with `HEIGHT` expiry in contract | UTXO model: select which boosts to spend per training action |
| **Cooldowns** | `last_action_at` timestamps (6 hours between regular actions) | `HEIGHT >= lastHeight + 180` (180 blocks ≈ 6h) | Bonus actions bypass cooldown. Block height more reliable than timestamps |
| **Fee collection** | Shadow-tracked in `credit_ledger` table (0.01 ERG per training, per-race entry fees, payouts) | User TX includes fee output natively | Credit ledger data informs Phase 2 fee calibration |
| **Auth** | On-chain NFT ownership verified via Explorer API (no wallet signing in Phase 1) | TX signature = auth (native to UTXO model) | Phase 1 checks balance endpoint; Phase 2 is native UTXO ownership |
| **Leaderboard** | `season_leaderboard` table | Separate AVL tree or extended creature tree | Indexed off-chain for fast reads |
| **Training log** | `training_log` table (with `bonus_action` flag, `boosted` flag) | On-chain TX history | Indexed by scanner for frontend display |

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

## Image Caching Proxy & Fallback (2026-02-12)

### Problem
CyberPet images were loaded directly from `api.ergexplorer.com/nftcache/` — an external service that frequently returns 404s (as seen in the screenshot for pet #146). Broken images degraded the UI experience.

### Solution: Three-Layer Resilience
1. **Caching proxy** (`/api/v2/img/[number]`) — All image URLs now point to our own domain. The proxy tries ergexplorer first, falls back to cyberversewiki.com, and returns the image with `Cache-Control: public, max-age=31536000, immutable`. Vercel's CDN caches at the edge globally.
2. **Client-side fallback** — New `<PetImage>` component tries the proxy URL; on `onError`, swaps to `cyberversewiki.com` directly.
3. **External cache** — Lexy (cyberversewiki.com) hosts pre-cached images for all pets at `https://www.cyberversewiki.com/img/cyberpets/{number}.png`.

### Performance Benefits
- **CDN edge caching**: After first load, images served from Vercel's 300+ PoPs — no origin hit
- **No cross-origin overhead**: Same-domain requests eliminate extra DNS lookups, TLS handshakes, CORS
- **Immutable browser cache**: Once loaded, pet images cached locally for 1 year
- **Invisible failover**: If ergexplorer is slow/down, proxy falls through to cyberversewiki before returning to client

### New Endpoint

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /api/v2/img/:number` | `api/v2/img/[number].ts` | Image caching proxy — tries ergexplorer, falls back to cyberversewiki, returns with 1yr immutable cache |

### Files Changed
- `api/v2/img/[number].ts` — **NEW**: Image proxy endpoint
- `api/_lib/helpers.ts` — `getCreatureImageUrl()` now returns `/api/v2/img/{number}` (proxy), added `getCreatureFallbackImageUrl()` (cyberversewiki direct)
- `api/v2/leaderboard.ts` — Added `fallbackImageUrl` to response
- `lib/cyberpets/index.ts` — `getImageUrl()` updated to proxy, added `getFallbackImageUrl()`
- `src/types/game.ts` — Added `fallbackImageUrl?` to `CreatureWithStats` and `LeaderboardEntry`
- `src/components/creatures/PetImage.tsx` — **NEW**: Reusable image component with `onError` fallback
- `src/components/creatures/CreatureCard.tsx` — Uses `<PetImage>`
- `src/components/creatures/CreatureHeader.tsx` — Uses `<PetImage>`
- `src/components/training/CreatureTrainHeader.tsx` — Uses `<PetImage>`
- `src/pages/Train.tsx` — Uses `<PetImage>`
- `src/pages/Leaderboard.tsx` — Uses `<PetImage>` (both podium + table)

---

## Training Result Modal — Secondary Stat Bar (2026-02-12)

### Problem
The training result modal showed an animated progress bar for the primary stat gain but not the secondary stat. Only the number animation appeared for the secondary stat (e.g., Focus showed `17.9 → 22.89 +4.99` with no bar).

### Fix
Added the same animated bar to the secondary stat section in `TrainingResultModal.tsx`. Uses the same `transition-all duration-1000 ease-out` animation and stat-colored background.

### Files Changed
- `src/components/training/TrainingResultModal.tsx` — Added animated bar to secondary stat display

---

## Race Auto-Resolve (2026-02-11)

### Problem
Races stayed in `open` status after their entry deadline passed, requiring an admin to manually resolve them via the admin dashboard. Players saw "Ready!" on expired races with no automatic resolution.

### Solution
Lazy auto-resolution: when any user loads the Races page (`GET /api/v2/races`), the server checks for expired open races with `auto_resolve = true` and resolves them inline before returning results. The first visitor after a deadline pays 2-3s of latency; subsequent visitors see the race already resolved.

### Changes
- **`api/_lib/resolve-race.ts`** — **NEW**: Extracted 235-line resolve logic from admin endpoint into shared `resolveRace(raceId)` function. Concurrency-safe lock via conditional `UPDATE ... WHERE status = 'open'`.
- **`api/v2/admin/races/resolve.ts`** — Refactored to thin wrapper (~30 lines) calling shared function
- **`api/v2/races/index.ts`** — Added auto-resolve check before returning race list
- **`api/v2/admin/races/create.ts`** — Accepts `autoResolve` param (default true)
- **`api/v2/admin/races/update.ts`** — Accepts `autoResolve` param
- **`src/pages/Admin.tsx`** — Auto-resolve checkbox on create/edit forms, badge on open races
- **`src/components/races/RaceCard.tsx`** — `onExpired` callback when countdown hits zero, 10s polling near deadline
- **`src/pages/Races.tsx`** — Refetches races 2s after a card expires
- **`src/types/game.ts`** — Added `autoResolve` to `Race` interface

### DB Migration
```sql
ALTER TABLE season_races ADD COLUMN auto_resolve BOOLEAN NOT NULL DEFAULT true;
```

### Phase 2 Note
The `auto_resolve` column carries forward unchanged. Off-chain bot will query `WHERE auto_resolve = true AND resolve_at_height <= current_height` instead of wall-clock time.

---

## Credit Ledger — Shadow Billing (2026-02-12)

### Overview
Tracks theoretical ERG fees and payouts per wallet without moving real ERG. Every training action, race entry, race payout, and season payout records a ledger entry with type, amount (nanoErg), and optional metadata. This provides:
1. **Usage data** — How much each player would owe/earn under real fees (informs Phase 2 fee calibration)
2. **Audit trail** — Full history of all billable actions per wallet
3. **Balance computation** — Running credit balance = payouts received - fees incurred

### Ledger Entry Types
| Type | Amount | When |
|------|--------|------|
| `training_fee` | -10,000,000 nanoErg (-0.01 ERG) | Every training action |
| `race_entry_fee` | -`entry_fee_nanoerg` (per race) | Every race entry |
| `race_payout` | +prize pool share | Race resolution (1st/2nd/3rd) |
| `season_payout` | +season prize share | Season end |

### DB Migration (`migrations/007_credit_ledger.sql`)
```sql
CREATE TABLE credit_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL,
  entry_type      TEXT NOT NULL,
  amount_nanoerg  BIGINT NOT NULL,
  creature_id     UUID REFERENCES creatures(id),
  race_id         UUID REFERENCES season_races(id),
  season_id       UUID REFERENCES seasons(id),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_credit_ledger_wallet ON credit_ledger(wallet_address);
CREATE INDEX idx_credit_ledger_type ON credit_ledger(entry_type);
```

### API
- `GET /api/v2/wallet/:address/ledger` — Returns entries array + computed balance (sum of all amounts)

### Files Changed
- `api/_lib/constants.ts` — Added `TRAINING_FEE_NANOERG = 10_000_000`
- `api/_lib/credit-ledger.ts` — **NEW**: `recordLedgerEntry()` helper
- `api/v2/train.ts` — Records `training_fee` entry on each training action
- `api/v2/races/[id]/enter.ts` — Records `race_entry_fee` entry on race entry
- `api/_lib/resolve-race.ts` — Records `race_payout` entries for prize winners
- `api/v2/admin/seasons/end.ts` — Records `season_payout` entries
- `api/v2/wallet/[address]/ledger.ts` — **NEW**: Wallet ledger endpoint
- `src/api/useWalletLedger.ts` — **NEW**: Frontend hook
- `src/types/game.ts` — Added `LedgerEntry`, `WalletLedger` types

### Phase 2 Note
Credit ledger entries map directly to on-chain TX fees. When real ERG transactions are enforced, the ledger becomes a read cache indexed from chain TXs. Historical shadow data provides fee calibration benchmarks.

---

## ErgoPay Mobile Wallet Integration (2026-02-12)

### Overview
Added ErgoPay (EIP-20) as a second wallet connection method alongside Nautilus. Mobile users scan a QR code or tap a deep link to connect their Ergo wallet. The flow uses a self-hosted `#P2PK_ADDRESS#` replacement pattern — no dependency on external services.

### How It Works
1. Frontend calls `POST /api/v2/ergopay/init` → creates session in DB, returns `ergopay://` URL
2. QR code / deep link shown to user containing: `ergopay://{host}/api/v2/ergopay/connect/{sessionId}/#P2PK_ADDRESS#`
3. Mobile wallet strips `ergopay://`, adds `https://`, replaces `#P2PK_ADDRESS#` with real address, calls GET
4. Backend stores address in session row
5. Frontend polls `GET /api/v2/ergopay/status/{sessionId}` every 2s until `connected` or `expired`
6. On connect: address saved to localStorage as `{ type: 'ergopay', address: '9...' }`, trusted on reconnect

### Capability Differences
| Capability | Nautilus | ErgoPay |
|-----------|---------|---------|
| Get address | Yes | Yes (via session) |
| Query balance | Yes | No |
| Sign messages | Yes | No |
| Submit transactions | Yes | No |
| Reconnect | Auto (extension API) | localStorage trust |

ErgoPay users can browse, train (server-verified), and enter free races. Paid transactions (Phase 2) will require Nautilus or an ErgoPay payment flow extension.

### DB Migration (`migrations/008_ergopay_sessions.sql`)
```sql
CREATE TABLE ergopay_sessions (
  id         TEXT PRIMARY KEY,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);
CREATE INDEX idx_ergopay_sessions_expires ON ergopay_sessions(expires_at);
```

### Environment Variables
- `ERGOPAY_HOST` — Production: `nft-races.vercel.app`. Falls back to `VERCEL_URL` then `localhost:3000`.
- Must be set via `vercel env add` for each environment (Development, Preview, Production).

### Files Changed
- `api/v2/ergopay/init.ts` — **NEW**: Create session + return ergopay:// URL
- `api/v2/ergopay/connect/[sessionId]/[address].ts` — **NEW**: Wallet callback (stores address)
- `api/v2/ergopay/status/[sessionId].ts` — **NEW**: Session polling endpoint
- `src/lib/ergo/ergopay.ts` — **NEW**: Frontend helpers (initSession, pollStatus, isMobile)
- `src/context/WalletContext.tsx` — Dual wallet type (`nautilus` | `ergopay`), capability flags, ErgoPay connect/poll/cancel, localStorage migration
- `src/components/layout/WalletConnect.tsx` — Wallet selection dialog (Nautilus vs ErgoPay), QR code display, polling status UI
- `src/api/useCreatures.ts` — Auth headers wrapped in try/catch (graceful skip for ErgoPay)
- `package.json` — Added `qrcode.react` dependency

---

## Mobile Responsiveness & Code Splitting (2026-02-11)

### Mobile Navigation — FAQ Added
FAQ was inaccessible on mobile — the bottom nav only rendered the 4 primary `navItems`. Fixed by spreading `[...navItems, ...secondaryItems]` in the mobile render path, giving all 5 items equal space via `grid grid-cols-5`.

### Mobile Responsiveness Fixes (375px audit)
- **Dialog viewport safety** (`src/components/ui/dialog.tsx`) — Changed `w-full` to `w-[calc(100%-2rem)]` so modals don't clip on narrow phones. Single fix in base component applies to all modals.
- **FAQ example cards** (`src/pages/FAQ.tsx`) — Changed `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` so cards stack on phones <640px.
- **Leaderboard table** (`src/pages/Leaderboard.tsx`) — Added `overflow-x-auto` to table container to prevent horizontal overflow.
- **Podium sizing** (`src/components/races/Podium.tsx`) — Reduced `min-w-[120px]` to `min-w-[100px] md:min-w-[140px]` and `p-4` to `p-3 md:p-4`.

### Scrollbar Clipping Fix
Windows Chrome DevTools scrollbar was consuming ~17px of viewport width, clipping the fixed-position bottom nav on simulated mobile viewports. Hidden scrollbar entirely with `scrollbar-width: none` (Firefox) and `::-webkit-scrollbar { display: none }` (Chrome/Safari/Edge).

### Route-Level Code Splitting
All 10 page imports converted from static to `React.lazy()` with a `Suspense` fallback using the existing `Skeleton` component. Vite now produces per-route chunks:
- **Before**: Single 879KB JS chunk (248KB gzipped)
- **After**: Core bundle 324KB + CreatureProfile/Recharts 367KB loaded on demand
- ~63% reduction in initial bundle size

### Files Changed
- `src/components/layout/Navigation.tsx` — FAQ in mobile nav, `grid-cols-5` layout, overflow-hidden on items
- `src/App.tsx` — `React.lazy()` imports, `Suspense` wrapper with `PageLoader` fallback
- `src/components/ui/dialog.tsx` — `w-[calc(100%-2rem)]` viewport safety
- `src/pages/FAQ.tsx` — Responsive grid `grid-cols-1 sm:grid-cols-2`
- `src/pages/Leaderboard.tsx` — `overflow-x-auto` on table container
- `src/components/races/Podium.tsx` — Reduced min-widths and padding for mobile
- `src/index.css` — `overflow-x: hidden`, hidden scrollbar CSS

---

## Rarity Base Stats Fix & Type System Update (2026-02-11)

### Problem
All creatures started with identical base stats regardless of rarity. The `computeBaseStats()` function correctly reads rarity tiers from `collections.base_stat_template`, but this DB field was never populated. Every creature fell through to the 60-point Common fallback.

### Root Cause
Database configuration gap — no migration or seed script ever set `collections.base_stat_template`. The code was correct; the data was missing.

### Fix
1. **`scripts/fix-base-stat-template.ts`** — Populates `collections.base_stat_template` with 9 rarity tiers:
   - Common: 60, Uncommon: 70, Rare: 80, Masterwork: 85, Epic: 90, Relic: 95, Legendary: 100, Mythic: 110, Cyberium: 120
2. **`scripts/recompute-base-stats.ts`** — Recomputes `creatures.base_stats` for all 460 creatures using corrected template
3. **Rarity type system** — Added `masterwork` and `relic` to `Rarity` type, CSS variables, tailwind config, and all `rarityStyles` maps across 10 files
4. **FAQ update** — Added clean rarity budget table with all 9 tiers, restored Common vs Epic example, added Masterwork/Relic/Cyberium to rarity badge list

### Files Changed
- `scripts/fix-base-stat-template.ts` — **NEW**: DB template population script
- `scripts/recompute-base-stats.ts` — **NEW**: Base stats recomputation script
- `src/index.css` — Added `--rarity-masterwork` and `--rarity-relic` CSS variables
- `tailwind.config.ts` — Added `masterwork` and `relic` to rarity color map
- `src/types/game.ts` — Added `'masterwork' | 'relic'` to `Rarity` type
- `src/data/mockData.ts` — Same type + `getRarityColor` update
- `src/lib/utils.ts` — Added entries in `getRarityColor`
- `src/components/creatures/StatBar.tsx` — Added `rarityStyles` entries
- `src/components/creatures/CreatureHeader.tsx` — Added `rarityStyles` entries
- `src/components/races/ResultsTable.tsx` — Added `rarityStyles` entries
- `src/components/races/RaceDetailsModal.tsx` — Added `rarityStyles` entries
- `src/components/races/Podium.tsx` — Added `rarityStyles` entries
- `src/pages/FAQ.tsx` — Rarity budget table, badges, restored example

### Next Steps — New Season
1. End current season: `POST /api/v2/admin/seasons/end` with `{ seasonId: "<current>" }`
2. Start new season: `POST /api/v2/admin/seasons/start` with `{ collectionId: "<cyberpets-collection-id>" }`
3. All trained stats reset to 0, fatigue resets, sharpness to 50 — base stats (now correctly differentiated by rarity) persist

---

## Admin Improvements & Race Lifecycle Fixes (2026-02-10)

### Problem
Cancelled races disappeared from the admin panel entirely — the API excluded them and the UI had no section for them. Additionally, the "Resolve" button was easy to accidentally click, which could cancel a race with <2 entries with no way to recover.

### Fixes
- **Races API** (`api/v2/races/index.ts`) — Now includes cancelled races in the response alongside open/resolved
- **Reopen endpoint** (`api/v2/admin/races/reopen.ts`) — **NEW**: Admin can restore cancelled races back to open status with a fresh deadline
- **Admin UI** (`src/pages/Admin.tsx`):
  - Added "Cancelled Races" section with Reopen button (sets 60-min deadline, moves to Open Races)
  - Added resolve confirmation dialog — first click shows "Sure?" with "Yes, Resolve" / "No" buttons
  - Prevents accidental race cancellation from misclicks

### New Endpoints
| # | Endpoint | File | Purpose |
|---|----------|------|---------|
| 17 | `POST /api/v2/admin/races/update` | `api/v2/admin/races/update.ts` | Edit open race (name, type, deadline, max entries) |
| 18 | `POST /api/v2/admin/races/reopen` | `api/v2/admin/races/reopen.ts` | Reopen cancelled race (sets status back to open) |

### Alpha Testing Plan Refresh
Replaced step-by-step setup guide (all steps now verified working) with comprehensive testing checklists covering: multi-user scenarios, edge cases, race lifecycle, reward validation, and balance tuning areas.

---

## Discrete Boost Rewards (UTXO-Style) — 2026-02-09

### Overview
Race rewards now produce **discrete, spendable boost rewards** instead of a single accumulating `boost_multiplier` on `creature_stats`. Each boost is a separate row in `boost_rewards` with an Ergo block height expiry (~3 days / 2160 blocks). Players select which boosts to consume at training time via a chip-selector UI in the confirm modal.

### Migration
- `migrations/006_boost_rewards_table.sql` — Creates `boost_rewards` table with partial index on unspent boosts

### Boost Lifecycle
1. **Awarded**: Race resolution inserts a `boost_rewards` row with `multiplier`, `awarded_at_height`, and `expires_at_height = awarded + 2160`
2. **Displayed**: Creature API endpoints return `boosts[]` (available, unspent, unexpired). Frontend shows count + expiry in BoostBanner, selectable chips in confirm modal
3. **Consumed**: Training endpoint accepts `boostRewardIds[]`, validates ownership/expiry, sums multipliers, applies to stat gains, marks rows as `spent_at` + links to `training_log.id`
4. **Expired**: Boosts past their `expires_at_height` are filtered out of API responses. ~3 days to use them

### Reward Structure (unchanged)
| Position | Reward |
|----------|--------|
| 1st | +1 Bonus Action (on `creature_stats`) |
| 2nd | +50% Boost (discrete row) |
| 3rd | +25% Boost (discrete row) |
| 4th+ | +10% Boost (discrete row) |

### Files Changed
- `api/_lib/helpers.ts` — Added `getLatestErgoBlock()`, updated `computeCreatureResponse()` with boosts parameter
- `lib/training-engine.ts` — `applyRaceRewards()` now inserts `boost_rewards` rows, exported `BOOST_EXPIRY_BLOCKS = 2160`
- `api/v2/admin/races/resolve.ts` — Uses shared `getLatestErgoBlock()`, passes `raceId` + `blockHeight` to `applyRaceRewards()`
- `api/v2/train.ts` — Accepts `boostRewardIds[]`, validates+consumes discrete boosts, returns `totalBoostMultiplier` + `boostsConsumed`
- `api/v2/creatures/[id]/index.ts` — Fetches available boosts for response
- `api/v2/creatures/by-wallet/[address].ts` — Batch-fetches available boosts
- `src/types/game.ts` — Added `BoostReward` interface, `boosts` on `CreatureWithStats`, `totalBoostMultiplier`/`boostsConsumed` on `TrainResponse`
- `src/api/useTraining.ts` — `useTrain()` accepts optional `boostRewardIds`
- `src/components/training/TrainingConfirmModal.tsx` — Boost selector UI (toggleable chips with expiry labels, Select All/Clear, projected gains preview)
- `src/components/training/BoostBanner.tsx` — Shows boost inventory with individual multipliers and expiry
- `src/components/training/ActivityCard.tsx` — Simplified to `hasBoostsAvailable` boolean indicator
- `src/components/training/TrainingResultModal.tsx` — Shows consumed boost total from server response
- `src/components/creatures/RewardBadges.tsx` — Shows boost count instead of percentage
- `src/components/creatures/CreatureCard.tsx` — Uses `creature.boosts.length` for reward check
- `src/components/creatures/CreatureHeader.tsx` — Uses `creature.boosts.length` for reward check
- `src/pages/Train.tsx` — Block height fetch on mount, boost selection orchestration, passes `boostRewardIds` to train mutation

### Phase 2 Note
`boost_rewards` mirrors the on-chain UTXO model — each boost is a "box" with a value and expiry height. In Phase 2, these will be actual Ergo boxes (reward tokens) sent to the NFT owner's address, consumed as TX inputs when training.

---

## Score Breakdown, FAQ, & Bug Fixes (2026-02-09)

### Score Breakdown Redesign
The race results score breakdown was showing `Weighted: 0` and raw modifier values with no context. Completely redesigned:

**Backend** (`api/v2/races/[id]/results.ts`):
- Now loads `game_config` to get `race_type_weights` for the race type
- Computes proper `weightedScore` (each stat × its weight, summed)
- Recomputes `rngMod` deterministically from stored `block_hash` + creature ID using `seedrandom`
- Includes raw fatigue/sharpness values and the weights map in the breakdown response

**Frontend** (`src/components/races/ResultsTable.tsx`):
- **Stat Contributions grid**: Shows each stat with effective value, weight multiplier, and contribution. Key stats (weight >= 0.20) highlighted
- **Score Pipeline**: Visual flow: Base Power → Fatigue (%) → Sharpness (%) → Luck (%) → Final Score
- **Formula hint**: `Final = Base Power × Fatigue × Sharpness × (1 + Luck)`

### FAQ Page
- `src/pages/FAQ.tsx` — **NEW**: Comprehensive game guide with accordion sections
- Covers: stats, training, fatigue/sharpness, race types, scoring formula, rewards/boosts, rarity, Focus & luck, seasons, blockchain integration
- Route: `/faq`, accessible from HelpCircle icon at bottom of sidebar navigation

### Training Math Fix
The frontend confirm modal showed projected gains that didn't match actual results. Root cause: hardcoded activity gain values in `trainingActivities.ts` didn't match the `game_config` database values.
- `api/v2/config.ts` — **NEW**: Public endpoint exposing activity definitions and race type weights from `game_config`
- `src/api/useGameConfig.ts` — **NEW**: Hook to fetch game config
- `src/pages/Train.tsx` — Merges real server config into activity definitions, falling back to hardcoded defaults if fetch fails. Projected gains in confirm modal now match actual server-side computation.

### Creature Profile Fixes
- **Race History**: Was hardcoded mock data (2 fake races). Now queries real race entries from `season_race_entries` table.
  - `api/v2/creatures/[id]/race-history.ts` — **NEW**: Returns all resolved race entries for a creature
  - `src/api/useRaceHistory.ts` — **NEW**: Hook for race history
- **Training Log "Invalid Date"**: The CreatureProfile page was remapping training logs into a wrong object shape (`date` instead of `createdAt`, missing `statChanges`, `wasBoosted`). Now passes raw API response directly to `<TrainingLog />`.

### New API Endpoints

| # | Endpoint | File | Purpose |
|---|----------|------|---------|
| 15 | `GET /api/v2/config` | `api/v2/config.ts` | Public game config (activities, race type weights) |
| 16 | `GET /api/v2/creatures/:id/race-history` | `api/v2/creatures/[id]/race-history.ts` | Race entries for a creature |

### New Frontend Hooks

| Hook | Endpoint | Type |
|------|----------|------|
| `useGameConfig` | `GET /api/v2/config` | Query |
| `useRaceHistory` | `GET /api/v2/creatures/:id/race-history` | Query |

### Updated Types
- `ScoreBreakdown` — Added `raceTypeWeights`, raw `fatigue`/`sharpness` values

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
