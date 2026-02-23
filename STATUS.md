# CyberPets Racing — Build Status & Roadmap

**Date:** 2026-02-23
**Phase:** 1 (DB + API — Beta Season)

---

## Current State

Full game loop is operational: wallet connect → auto-discover NFTs → train → enter races → view results. **Multi-collection support live** — CyberPets and Aneta Angels (4406 tokens) both playable with independent seasons, leaderboards, and stat systems. All 27 API endpoints built, all frontend hooks wired, admin page for race management. Races auto-resolve when their deadline passes (lazy resolution on page load). **Rarity class races** — Rookie/Contender/Champion classes restrict entry by creature rarity with reduced league points and recovery rewards. **Batch race entry** — N creatures entered in one TX with one wallet signature and one miner fee (Nautilus + ErgoPay + alpha). **Batch training** — Train up to 20 creatures in a single TX with per-creature activity overrides, auto-applied boosts/recovery packs, and grid matrix UI. Same N-output TX structure as batch race entry. Nautilus ERG + CYPX verified on mainnet. ErgoPay verified on live preview branch. **Dual-currency token fees** — Collections can define a fee token (e.g. CYPX) alongside ERG. Players choose payment currency via PaymentSelector toggle. Token payments use Babel boxes (EIP-0031) for zero-ERG UX — miner fee covered by pre-funded Babel boxes. Full Nautilus + ErgoPay support (both verified on mainnet). Health endpoint monitors Babel box liquidity. **Security audit complete** — 37-finding audit across security, code quality, and UX. All critical/high/medium fixes applied: TX dedup, timing-safe auth, rate limiting, input validation, security headers, ownership staleness checks, race capacity triggers, atomic leaderboard upserts, parallel race resolution, and responsive podium layout. **Season payout views** — Admin can expand past seasons to see full payout breakdown by pool (wins/places/shows) and per-creature. Dashboard shows user's confirmed season earnings. Leaderboard earnings accurately separate real payments from free-play shadow entries. **Public Seasons page** — browsable archive of active and completed seasons with collection filters, expandable leaderboards, and real ERG earnings. FAQ page explains all game mechanics. **Mobile UX overhaul** — All modals scrollable on small phones (max-h-[85vh]), responsive padding/text sizing, stat rows wrap gracefully instead of clipping. Header uses 65/35 banner/wallet split on mobile. Batch training hidden on mobile (unsupported). **Race status filter** — Filter pills (All/Open/Completed) on Races page with URL search params (`?view=completed`) for shareable links. Completed races sorted by entry deadline (most recent first). Currently in multi-user alpha testing.

### What Works
- Nautilus wallet connect/disconnect with auto-reconnect
- Ergo Mobile wallet connect/disconnect with auto-reconnect
- **Multi-collection support**: CyberPets + Aneta Angels (4406 tokens) with independent seasons, leaderboards, and stat systems
- **Auto-discovery**: NFTs in wallet are detected on-chain and auto-registered to DB across all supported collections
- Dashboard displays owned creatures with NFT images, collection filter pills, stale ownership auto-cleaned
- Training calls real API: stat gains, diminishing returns, actions counter (2/day), cooldown enforcement, per-collection config
- Discrete boost rewards: earned from races, selectable at training time, block-height expiry
- Race entry calls real API with on-chain ownership verification + collection guard (can only enter collection-matched races)
- Race results with full score breakdown (stat contributions, modifiers, luck)
- Leaderboard (collection-aware, per-season), creature profile, race history pages functional
- Admin page (`/admin`) for creating, editing, resolving, and reopening races — collection selector for race/season creation
- **Auto-resolve**: Expired races resolve lazily on next page load (per-race `auto_resolve` flag, default true)
- Cancelled races visible in admin with reopen capability
- Resolve confirmation dialog prevents accidental race cancellation
- On-chain NFT ownership verification on all mutation endpoints (train, race entry) — resilient to Explorer API outages (trusts DB owner when API unavailable)
- FAQ page with per-collection game mechanics guide (CyberPets / Aneta Angels pill selector, collection-specific base stats, rarity tiers, trait mapping, examples)
- **ErgoPay mobile wallet** — QR code / deep-link connect flow for mobile users (Nautilus + ErgoPay dual support)
- **Real ERG payments (Nautilus)** — Training (0.01 ERG) and race entry fees paid via Nautilus `sign_tx()`. Treasury box registers R4-R6 encode action type, NFT token ID, and context for on-chain verifiability. Credit ledger records `shadow=false` + `tx_id` for real payments. Both training and race entry verified on mainnet. Whale wallet support: change tokens split across multiple boxes for wallets with 100+ token types.
- **Single-TX batch race entry** — Entering N creatures into a race uses one TX with N treasury output boxes (each with its own R4-R6 registers). One wallet signature, one miner fee. Works for Nautilus, ErgoPay, and alpha (no-fee) modes. Verified on mainnet: 2 creatures × 0.05 ERG = 2 output boxes at treasury, single txId.
- **Single-TX batch training** — Train up to 20 creatures in one TX. Grid matrix UI with per-creature activity radio buttons, default activity pills, auto-apply boosts/recovery packs, expandable detail rows, inline MiniStatBars per creature (colored vertical bars with per-bar hover), and activity column stat dot indicators with hover tooltips showing gain details. Same N-output TX structure as batch race entry (R4=train, R5=tokenId, R6=activity per output). Same-collection enforced. Nautilus ERG + CYPX verified on mainnet. ErgoPay verified on live preview. Endpoint: `POST /api/v2/train-batch`.
- **ErgoPay TX flow** — Full reduced TX pipeline with R4-R6 registers. Server-side TX builder fetches UTXOs from Explorer API, builds unsigned TX with sigma-serialized registers, POSTs to `ergopay.duckdns.org/api/v1/reducedTx`. Wallet callback (`replyTo`) + blockchain fallback for payment detection. Verified on mainnet — registers decode correctly on ergexplorer (R4: train, R5: token ID, R6: mental_prep).
- **TX UX polish** — Confirm modals stay open with "Signing..." spinner while Nautilus is signing (no page flash). Result modals show animated success state + "Payment Confirmed" banner with truncated txId linking to ergexplorer.com. Data refetch deferred to modal close to prevent background flicker. Training result: stat gain animations + progress bars. Race entry result: entry count gauge (X/Y) with animated fill bar. Wallet Ledger entries show explorer link icons for on-chain transactions.
- **Credit ledger** — Tracks training fees, race entry fees, and season payouts per wallet. Supports both shadow (alpha) and real payments (`shadow` flag + `tx_id` column)
- **Gamified investment display** — Dashboard summary card, per-creature investment card, and `/wallet` ledger page showing ERG burned vs prize pool
- **Image caching proxy** — CyberPets via `/api/v2/img/[number]`, Aneta Angels via `/api/v2/img/token/[tokenId]`. Both proxied through Vercel CDN with `s-maxage` + `immutable` edge caching (1-year). Upstream: IPFS gateway (HTTPS-upgraded) → ergexplorer nftcache fallback. All API endpoints (creatures, leaderboard, ledger) pass collection-aware loaders for correct image URL resolution.
- **Wallet display names** — Users can set a friendly name (e.g. "Andrius") via wallet dropdown. Shown on leaderboard, race podium, and race results instead of truncated address. Names are unique (case-insensitive), 2-20 chars. Purely off-chain (stored in `wallet_profiles` table) — zero impact on Phase 2 smart contracts
- **Collection filter UI** — Reusable toggle pill component on Dashboard, Races, Leaderboard, Wallet Ledger, and Training pages. Wallet Ledger filter is fully wired: summary cards (Burned, Prize Pool, Activity) and transaction history all update per collection. Ledger entries include `collectionId`/`collectionName` derived from `season_id` join. Transaction rows show creature image + name and season name pill.
- **Fatigue/Sharpness rework** — Per-activity sharpness deltas (physical activities reduce, mental activities increase), wider race sharpness modifier (×0.80 to ×1.05), scaled fatigue decay tiers (3/day at low fatigue up to 15/day at high fatigue), 12h sharpness grace period then −15/day decay. All configurable via `game_config` JSON.
- **Meditation** — Recovery training action: 0 stat gains, −25 fatigue, +15 sharpness. Uses a training action slot. Recovery-specific UI mode in activity cards, confirm modal, and result modal (hides stat boosts, shows condition changes).
- **Treatment Center** — Three lockout-based recovery tiers: Stim Pack (6h, −20 fatigue), Cryo Pod (12h, −40 fatigue, sharpness→50), Full Reset (24h, fatigue→0, sharpness→30). Lazy completion model — effects applied when timer expires. Creatures locked from training/racing during treatment. Full ErgoPay + Nautilus + free-play fee flows. Treatment page with creature selection, tier cards, confirm/result dialogs with explorer TX links.
- **Rarity class races** — Rookie/Contender/Champion classes restrict entry by creature rarity. Per-collection rarity-to-class mapping via `game_config_overrides` (CyberPets: 3-3-3 split, Aneta Angels: 2-2-2 split). Fractional league points (1/7 weight vs open races). Recovery rewards (UTXO-style fatigue reduction packs) awarded from class race placements. Race entry modal filters by class eligibility, shows treatment/already-entered guards. Admin dropdown labels update dynamically when switching collections.
- **Dual-currency token fees (CYPX + ERG)** — Per-collection `fee_token` config in `game_config_overrides` JSONB. PaymentSelector toggle in all confirm modals (training, race entry, treatment). Nautilus: client-side Babel box TX via Fleet SDK manual swap (`SConstant.from()` + `ErgoUnsignedInput`/`OutputBuilder`). ErgoPay: server-side Babel box TX in `ergo-tx-builder.ts` with token-aware UTXO selection, POSTed via `ergopay.duckdns.org` relay. Both flows verified on mainnet. Token TX verification on-chain via Explorer API. Credit ledger records `fee_token_id` + `fee_token_amount`. Admin can set per-race `entry_fee_token`. Wallet ledger shows token amounts. Health endpoint monitors Babel box liquidity per collection. CYPX Babel box created and funded on mainnet.
- **Security hardening (audit complete)** — Timing-safe admin auth, input validation (UUID/address/token/name), TX dedup via `credit_ledger`, on-chain TX amount verification via Explorer API, security headers (X-Frame-Options, HSTS, nosniff, Referrer-Policy, Permissions-Policy), process-local rate limiting on all mutation endpoints, 24h ownership staleness check when Explorer unavailable, race capacity enforcement trigger, atomic leaderboard upsert RPC, SUM-based wallet balance (race-condition-safe), parallel race resolution (~3 queries instead of ~60), reconciliation script for ledger integrity, responsive podium layout on mobile.
- **Season payout views** — Admin: expandable past seasons with full payout breakdown (wins 40% / places 35% / shows 25% pools), per-creature table sorted by total payout. Dashboard: Season Earnings card showing user's confirmed earnings with per-creature pool breakdown. Wallet ledger extended with `seasonPayouts` aggregation. Creature profile shows confirmed prestige earnings only (excludes current season speculative amounts).
- **Public Seasons page** (`/seasons`) — Collection filter pills, active season cards with prize pool + modifier, expandable past season rows with lazy-loaded leaderboard tables. Leaderboard shows rank, creature (image + rarity + link), owner (display name), W/P/S, league points, and real ERG earnings. Total distributed ERG computed from real earnings (per-race fee redistribution + season-end payouts), excluding free-play shadow entries.
- **Earnings accuracy** — Leaderboard ERG column now separates real from shadow earnings. Per-race prizes cross-referenced with `credit_ledger` to include only races with real (non-shadow) fee payments. Season-end payouts from `credit_ledger` `season_payout` entries. Falls back to `total_earnings_nanoerg` for pure free-play seasons.
- **Mobile UX overhaul** — Dialog base: `max-h-[85vh] overflow-y-auto`, responsive padding (`p-4 sm:p-6`), `overflow-x-hidden`, tighter margins (`w-[calc(100%-1rem)]` on mobile). Training confirm modal: all stat rows use `flex-wrap` + responsive text (`text-xs sm:text-sm`) + tighter gaps (`gap-1 sm:gap-2`). Race entry modal: creature cards with responsive padding + wrapping name/status rows. Creature train header: name+badge row wraps, stats row (Races/Wins/Earned) wraps. Header layout: 63%/35% banner/wallet split on mobile with `min-w-0` for truncation. Season banner mobile: `flex-wrap` for prize pool text. Wallet button: `w-full sm:w-auto` fills container on mobile. Batch training toggle hidden on mobile (`hidden md:inline-flex`).
- **Race status filter** — "Status: All | Open | Completed" filter pills on Races page, matching CollectionFilter styling. Uses URL search params (`/races?view=completed`) for shareable/bookmarkable links. Sections conditionally rendered per view. Empty state for completed view. Completed races sorted by `entry_deadline DESC` (most recently run first, not creation date).

### Open Items
- [x] **Training cost (0.01 ERG)** — Real ERG payments via Nautilus. Treasury box registers (R4-R6) for on-chain traceability. Verified on mainnet.
- [x] **Race entry fee (0.05 ERG)** — Same TX flow as training. Per-race entry fee via `season_races.entry_fee_nanoerg`. Nautilus verified on mainnet — registers + result modal + ledger all working.
- [x] **TX UX** — Confirm modals hold open during Nautilus signing ("Signing..." state). Result modals with Payment Confirmed banner + ergexplorer link. Deferred refetch prevents page flicker.
- [x] **ErgoPay TX with registers** — Switched from `POST /payment/addrequest` (simple payment, no register support) to `POST /api/v1/reducedTx` (full unsigned TX with R4-R6 registers). Server-side UTXO fetching, sigma serialization, wallet callback endpoint. Verified on mainnet — registers visible in mobile wallet signing screen and decoded correctly on ergexplorer.
- [x] **Single-TX batch race entry** — Entering N creatures into a race now uses a single TX with N treasury output boxes (one per creature, each with R4-R6 registers). One wallet signature, one miner fee. Works for Nautilus, ErgoPay, and alpha (no-fee) modes. Batch endpoint: `POST /api/v2/races/:id/enter-batch`.
- [ ] **Vercel deployment** — Push to deploy. Env vars set.

### Infrastructure

| Component | Stack | Status |
|-----------|-------|--------|
| Frontend | Vite + React SPA | All pages + admin page |
| Backend | Vercel Serverless Functions (`api/`) | All 16 endpoints + admin |
| Database | Supabase (PostgreSQL) | Schema live, Season 1 created |
| Blockchain | Ergo (Explorer API for ownership verification) | Integrated — single-call balance fetch |
| Wallet | Nautilus (EIP-12) + ErgoPay (EIP-20) | Desktop + mobile wallet connect |
| Payments | Nautilus `sign_tx()` + ErgoPay reduced TX (registers) | Training + race fees live (both wallets verified on mainnet) |
| Auth | On-chain NFT ownership via Explorer API | TX signature for payments; native UTXO auth in Phase 2 |
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
| 11 | `GET /api/v2/wallet/:address/profile` | `api/v2/wallet/[address]/profile.ts` | Wallet display name (get or set via PUT) |
| 12 | `GET /api/v2/ergopay/status/:sessionId` | `api/v2/ergopay/status/[sessionId].ts` | Poll ErgoPay session status |
| 12 | `GET /api/v2/img/:number` | `api/v2/img/[number].ts` | CyberPets image proxy (ergexplorer → cyberversewiki fallback, 1yr CDN edge cache) |
| 13 | `GET /api/v2/img/token/:tokenId` | `api/v2/img/token/[tokenId].ts` | Token image proxy (IPFS → ergexplorer fallback, 1yr CDN edge cache) |
| 14 | `GET /api/v2/races/:id/entries` | `api/v2/races/[id]/entries.ts` | Creature IDs entered by wallet in a race (`?wallet=ADDRESS`) |
| 15 | `GET /api/v2/seasons` | `api/v2/seasons/index.ts` | All seasons (active + completed), optional `?status=` and `?collectionId=` filters |

### Public POST Endpoints (User Actions)

| # | Endpoint | File | Purpose |
|---|----------|------|---------|
| 10 | `POST /api/v2/creatures/register` | `api/v2/creatures/register.ts` | Register NFT — verifies on-chain ownership |
| 11 | `POST /api/v2/train` | `api/v2/train.ts` | Train creature — validates cooldowns, applies gains |
| 12 | `POST /api/v2/races/:id/enter` | `api/v2/races/[id]/enter.ts` | Enter race — snapshots stats, validates limits |
| 13 | `POST /api/v2/ergopay/init` | `api/v2/ergopay/init.ts` | Create ErgoPay session, return ergopay:// URL |
| 14 | `POST /api/v2/treatment/start` | `api/v2/treatment/start.ts` | Start treatment — validates creature state, applies lockout |
| 15 | `POST /api/v2/ergopay/tx/request` | `api/v2/ergopay/tx/request.ts` | Create ErgoPay payment request (training, race entry, or treatment fees) |
| 16 | `POST /api/v2/races/:id/enter-batch` | `api/v2/races/[id]/enter-batch.ts` | Batch enter N creatures into race (single txId, all-or-nothing validation) |
| 17 | `POST /api/v2/train-batch` | `api/v2/train-batch.ts` | Batch train up to 20 creatures (single txId, same collection, partial success 207) |

### Admin POST Endpoints (Bearer token auth)

| # | Endpoint | File | Purpose |
|---|----------|------|---------|
| 14 | `POST /api/v2/admin/seasons/start` | `api/v2/admin/seasons/start.ts` | Start new season, init creature stats |
| 15 | `POST /api/v2/admin/seasons/end` | `api/v2/admin/seasons/end.ts` | End season, compute payouts, update prestige |
| 16 | `POST /api/v2/admin/races/create` | `api/v2/admin/races/create.ts` | Create a new race |
| 17 | `POST /api/v2/admin/races/resolve` | `api/v2/admin/races/resolve.ts` | Resolve race — deterministic results from Ergo block hash |
| 18 | `POST /api/v2/admin/races/update` | `api/v2/admin/races/update.ts` | Edit open race (name, type, deadline, max entries) |
| 19 | `POST /api/v2/admin/races/reopen` | `api/v2/admin/races/reopen.ts` | Reopen cancelled race (sets status back to open) |
| 20 | `GET /api/v2/admin/seasons/:id/payouts` | `api/v2/admin/seasons/[seasonId]/payouts.ts` | Season payout breakdown (pools, per-creature amounts) |

### Utility Endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /api/health` | `api/health.ts` | Health check |
| `GET /api/v2/collections` | `api/v2/collections.ts` | List collections |
| `GET /api/v2/ergopay/connect/:sessionId/:address` | `api/v2/ergopay/connect/[sessionId]/[address].ts` | ErgoPay wallet callback (called by mobile wallet) |
| `POST /api/v2/ergopay/tx/callback/:requestId` | `api/v2/ergopay/tx/callback/[requestId].ts` | ErgoPay TX callback — wallet POSTs `{ signedTxId }` after signing |
| `GET /api/v2/ergopay/tx/status/:requestId` | `api/v2/ergopay/tx/status/[requestId].ts` | Poll ErgoPay TX request status (pending→executing→executed/expired/failed) |

### Shared Server Libraries

| File | Purpose |
|------|---------|
| `api/_lib/supabase.ts` | Supabase service client |
| `api/_lib/auth.ts` | Admin `CRON_SECRET` bearer token guard |
| `api/_lib/helpers.ts` | `getActiveSeason()`, `getLatestErgoBlock()`, `computeCreatureResponse()`, `countRegularActionsToday()`, `getLastRegularActionAt()` |
| `api/_lib/constants.ts` | Activity display map, reward labels, nanoErg conversion, `CLASS_RARITIES`, `LEAGUE_POINTS_BY_POSITION`, `RECOVERY_BY_POSITION` |
| `api/_lib/cyberpets.ts` | CyberPet JSON loader, trait parser, base stat computation (legacy — see also `collections/cyberpets.ts`) |
| `api/_lib/collections/types.ts` | `CollectionLoader` interface, `TokenEntry`, `Stats`, `StatName` types |
| `api/_lib/collections/registry.ts` | Collection loader registry — maps collection names to loaders |
| `api/_lib/collections/cyberpets.ts` | CyberPets collection loader (description-based trait parsing, IPFS proxy images) |
| `api/_lib/collections/aneta-angels.ts` | Aneta Angels collection loader (4406 tokens, normalized score distribution, IPFS images) |
| `api/_lib/config.ts` | Per-collection game config resolution (deep merge overrides from `collections.game_config_overrides`) |
| `api/_lib/register-creature.ts` | Shared creature registration (used by register endpoint + auto-discovery) |
| `api/_lib/resolve-race.ts` | Shared race resolution logic (used by admin endpoint + auto-resolve in GET /races) |
| `api/_lib/credit-ledger.ts` | Credit ledger helper — records training fees, race fees, payouts |
| `api/_lib/ergo-tx-builder.ts` | Server-side sigma serialization, Explorer UTXO fetching, unsigned TX builder with R4-R6 registers |
| `api/_lib/execute-action.ts` | Shared training/race entry executor (used by API endpoints + ErgoPay callback) |
| `api/_lib/execute-treatment.ts` | Treatment start + lazy completion logic (`executeTreatmentStart()`, `checkAndCompleteTreatment()`) |
| `api/_lib/verify-tx.ts` | TX dedup (`isTxIdUsed()`), on-chain amount verification (`verifyTxOnChain()`), payment detection (`detectPaymentOnChain()`) |
| `api/_lib/rate-limit.ts` | Process-local in-memory rate limiter (10-20 req/min/IP per action type) |

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
| `useWalletProfile` | `GET /api/v2/wallet/:address/profile` | Query |
| `useUpdateWalletProfile` | `PUT /api/v2/wallet/:address/profile` | Mutation |
| `useCollections` | `GET /api/v2/collections` | Query |
| `useSeasons` | `GET /api/v2/seasons/current` | Query (array) |
| `useRaceEntries` | `GET /api/v2/races/:id/entries` | Query |
| `useEnterRaceBatch` | `POST /api/v2/races/:id/enter-batch` | Mutation |
| `useTrainBatch` | `POST /api/v2/train-batch` | Mutation |
| `useTreatment` | `POST /api/v2/treatment/start` | Mutation |
| `useAllSeasons` | `GET /api/v2/seasons` | Query |

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
7. [x] Multi-user test: two different wallets complete full loop concurrently

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
| **Race entry (single)** | API validates + DB insert | User TX: entry fee to race box + snapshot stats |
| **Race entry (batch)** | Batch endpoint validates all N + DB inserts. Single TX with N treasury outputs (one per creature, each with R4-R6 registers). One miner fee. | User TX: spends race box → appends N stat snapshots to R5 `Coll[Coll[Byte]]`. Single TX, single proof covering N AVL lookups. Reduces UTXO contention (1 TX vs N competing for same race box). |
| **Race resolution** | Admin calls API → DB update | Permissionless: anyone triggers → Contract reads `CONTEXT.headers(0).id` |
| **Prize distribution** | DB ledger (manual payout) | Contract auto-creates payout output boxes |
| **Leaderboard** | `season_leaderboard` table | AVL tree or extended creature tree |
| **Cooldowns** | `last_action_at` timestamps (6h / 180 blocks) | `HEIGHT >= lastHeight + 180` blocks |
| **Fee collection** | Real ERG via Nautilus `sign_tx()` (client-side TX) + ErgoPay reduced TX (server-side TX via `ergopay.duckdns.org/api/v1/reducedTx`). Both paths write R4-R6 registers to treasury box. `credit_ledger` records `shadow=false` + `tx_id`. | User TX includes fee output natively (already happening — registers bridge to Phase 2 scanner) |

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
| **Training cost** | 0.01 ERG (real on-chain payment via Nautilus/ErgoPay) | `TRAINING_FEE_NANOERG` in `constants.ts` |
| **Race entry fee** | Configurable per-race, real ERG payment (`entry_fee_nanoerg` column) | `season_races` table |
| **Treasury address** | `9gbgJTNX...C3vm` | `TREASURY_ADDRESS` env var |
| **TX registers** | R4: action type, R5: NFT token ID, R6: context | `buildRegisters()` in `transactions.ts` |
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
| **POST /races/:id/enter-batch** | **Same Race Entry Contract** — Single TX appends N stat snapshots to race box R5. Plasma service generates one proof covering N AVL lookups. Contract validates all N entries. | Batch is naturally better on-chain: 1 TX instead of N competing to spend the same race box UTXO. |
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

**AVL Tree via GetBlok Plasma (confirmed approach):**
- Single state box holds digest of entire creature tree — `PlasmaMap[ErgoId, CreatureState]`
- GetBlok Plasma is battle-tested Scala/JVM library on top of Ergo Appkit (same logic securing significant on-chain value)
- `LocalPlasmaMap` (LevelDB) provides persistent off-chain tree storage
- `ProxyPlasmaMap` enables safe proof generation: temporary tree for building TX proofs, `commitChanges()` on TX confirmation, `dropChanges()` on failure — no risk of corrupting persistent state
- Blake2b256 hashing, 32-byte digests — matches Ergo contract expectations
- Confirmed by GetBlok Plasma team: standalone Scala service is the production-recommended path. WASM/sigma-rust has partial AVL support but lacks full batch update + persistent storage integration (high effort, Rust dev required)

**CreatureState AVL Value (~28 bytes per creature):**
```
CreatureState {
  speed: Short, stamina: Short, acceleration: Short,
  agility: Short, heart: Short, focus: Short,
  fatigue: Short, sharpness: Short,
  baseBudget: Short,                    // total base stat budget (60-120) — for rarity class verification
  lastActionHeight: Int,
  actionsToday: Byte, bonusActions: Byte,
  dayStartHeight: Int    // 720 blocks = 1 "day" for action reset
}
```
Custom `ByteConversion[CreatureState]` for Plasma serialization. Key = NFT token ID (`ErgoId`, 32 bytes).

`baseBudget` is set once at creature registration (first training TX) and never changes. It enables on-chain rarity class verification — contracts check `baseBudget` range against race class boundaries (Rookie: 60-80, Contender: 85-95, Champion: 100-120) without needing off-chain trait data. See `PLAN-class-races.md`.

**Race State: Pure UTXO (NOT AVL):**
Races are short-lived, fixed-entrant entities — not a growing key-value set. Each race is a box:
- R4: race params (type, max entries, entry fee, deadline height, `rarityClass: Option[Coll[Byte]]`, `classWeight: Int`)
- R5: `Coll[Coll[Byte]]` of entrant snapshots (token ID + 6 stats, appended per entry TX)
- R6: deadline height
- Entry TX (single): spends old race box → creates new race box with snapshot appended. If `rarityClass` is set, contract validates entrant's `baseBudget` (from AVL tree read) falls within the class range.
- Entry TX (batch): spends old race box → creates new race box with N snapshots appended in one TX. Plasma service generates single proof covering N AVL lookups. Reduces UTXO contention (only 1 TX can spend a given race box per block, so batching N entries avoids N-way contention). Phase 1 batch flow (N treasury outputs) maps to Phase 2 batch flow (N snapshot appends).
- Resolution TX: spends race box → reads `CONTEXT.headers(0).id` → creates reward + payout + recovery pack boxes. League points weighted by `classWeight`.
- No Plasma/AVL involvement for race state itself (snapshots stored in registers), but Plasma is read for stat verification at entry time

**Boost Rewards: Actual UTXO Boxes:**
Each boost becomes a real Ergo box with `HEIGHT` expiry in contract. At training time, user includes boost boxes as TX inputs — consumed in same TX. No AVL tree involvement.

**Recovery Packs: Same UTXO Pattern (Class Races):**
Recovery packs (earned from rarity class races) follow the identical UTXO box pattern as boosts. At race resolution, the Resolution Contract creates recovery reward output boxes sent to participant addresses. Each box contains: fatigue reduction amount (R4), creature token ID (R5), expiry height (R6). Player consumes recovery boxes as TX inputs during training — fatigue reduction applied in the same AVL update as stat changes. This avoids O(N) AVL tree writes at resolution time (resolution only creates output boxes, not tree updates). See `PLAN-class-races.md`.

**Concurrency Model (multiple users training simultaneously):**
Only one proof can be valid per tree state. If two users train at the same time against the same tree digest, only the first TX to confirm succeeds (second proof is stale). Solutions:
- **Pessimistic queue** (recommended for current scale): TX builder service queues proof requests, generates one at a time, waits for confirmation before issuing next proof. ~2 min block time on Ergo. Fine for ~100 actions/day.
- **Batch updates**: Multiple training actions batched into one TX (update multiple AVL entries in one proof). Scales to higher throughput.
- **Optimistic retry**: Build proof, submit TX. If stale digest, regenerate + retry. Simple but burns miner fees on failures.

**Scala Plasma Service Architecture:**
```
┌──────────────┐     HTTP      ┌──────────────────────┐
│ Vercel API   │──────────────▶│ Scala Plasma Service  │
│ (TypeScript) │◀──────────────│ (Docker on Fly.io)    │
└──────────────┘               │                       │
                               │ • LocalPlasmaMap      │
                               │   (LevelDB persistent)│
                               │ • ProxyPlasmaMap      │
                               │   (proof generation)  │
                               │ • Akka/Tapir HTTP     │
                               │ • Pessimistic queue   │
                               └──────────────────────┘
```
HTTP hop is negligible vs 2-min block confirmation. Endpoints:
1. `GET /proof/lookup?tokenId=...` — read creature state from tree
2. `POST /proof/training` — generate proof for stat update, return proof bytes
3. `POST /proof/race-snapshot` — read + prove stat snapshot for race entry
4. `POST /commit` — commit changes after TX confirmation
5. `POST /rollback` — drop uncommitted changes on TX failure

**Off-chain services that persist:**
- **Scala Plasma Service** — holds `LocalPlasmaMap` (LevelDB), generates AVL proofs, commits on TX confirmation. Docker on Fly.io/Railway.
- **TX Builder** — constructs training/race TXs with AVL proofs for Nautilus signing. Could live in Scala service or as a separate TS layer.
- **Indexer/Scanner** — watches chain, mirrors to Supabase for fast API reads. Doesn't need Plasma — reads box registers and decodes values. Existing sigma serialization helpers (reversed to deserialize) handle register reading.
- **Frontend** — identical React app, same API shape, data source shifts to chain-synced DB
- **Race Scheduler** — creates race boxes on schedule (could also be on-chain with height-based triggers)

**Admin Operations in Phase 2:**
| Phase 1 (DB-only) | Phase 2 (On-Chain) | Register Layout |
|--------------------|--------------------|-----------------|
| `POST /admin/races/create` | Creates race box UTXO | R4: race params, R5: empty entrants, R6: deadline height |
| `POST /admin/seasons/start` | Creates season box UTXO | R4: AVL tree digest (all stats zeroed), R5: season params (end height, prize pool = 0) |
| `POST /admin/seasons/end` | Automated: `HEIGHT >= end_height` | Contract reads leaderboard from AVL tree, creates payout output boxes |
| `POST /admin/races/resolve` | Permissionless: anyone triggers | Contract reads `CONTEXT.headers(0).id`, computes scores, creates reward boxes |

### Migration Steps

| Step | Action | Timing |
|------|--------|--------|
| 1 | Launch Phase 1, start playtesting | Now |
| 2 | Gather balance data from ~100 races | 2-4 weeks |
| 3 | Finalize constants (stat gains, fatigue curves, prize splits) | After data analysis |
| 4 | Write ErgoScript contracts (Training, Race Entry, Resolution, Season Payout) | 2-3 weeks |
| 5 | Build Scala Plasma Service (Akka/Tapir HTTP + LocalPlasmaMap + proof queue) | 1-2 weeks |
| 6 | Build TX Builder integration (Vercel API → Plasma Service → Nautilus) | 1 week |
| 7 | Build Indexer/Scanner (watch chain → Supabase mirror) | 1 week |
| 8 | Deploy to Ergo testnet, run parallel with DB version | 1-2 weeks testing |
| 9 | Deploy to mainnet — DB becomes read-only indexer | Production launch |
| 10 | Open-source frontend + TX builder + Plasma service | Post-launch |

---

## Multi-Collection Architecture (2026-02-14)

### Overview
The platform now supports multiple NFT collections racing independently. Each collection has its own season, leaderboard, stat system, trait-to-stat mapping, and image resolution chain. The architecture is designed so adding a new collection requires only: one loader module, one DB row, and a JSON trait data file.

### Collections Supported
| Collection | Tokens | Rarity Tiers | Stat Budget Range | Image Source |
|------------|--------|-------------|-------------------|--------------|
| **CyberPets** | 460 | 9 (Common–Cyberium) | 60–120 | Proxy (`/api/v2/img/[n]`) → ergexplorer → cyberversewiki |
| **Aneta Angels** | 4,406 | 6 (Common–Mythic) | 50–100 | IPFS gateway (primary) → ergexplorer nftcache (fallback) |

### Backend Changes (Steps 1–11)
- **Collection loader system** (`api/_lib/collections/`) — `CollectionLoader` interface with `isToken()`, `getToken()`, `parseTraits()`, `computeBaseStats()`, `buildMetadata()`, `getImageUrl()`, `getFallbackImageUrl()`, `getDisplayName()`, `getRarity()`
- **Registry** (`api/_lib/collections/registry.ts`) — Maps collection names to loader instances, auto-detects collection for any token ID
- **Per-collection game config** (`api/_lib/config.ts`) — Deep-merges `collections.game_config_overrides` over global `game_config`. Endpoint: `GET /api/v2/config?collectionId=`
- **Multi-season support** — `GET /api/v2/seasons/current` returns array when multiple active seasons exist. Each season belongs to a collection via `collection_id` FK
- **Auto-discovery** (`api/v2/creatures/by-wallet/[address].ts`) — Scans wallet tokens against all registered collections, not just CyberPets
- **Race entry guard** — Validates creature's collection matches race's season collection
- **Leaderboard** (`api/v2/leaderboard.ts`) — Accepts `?collectionId=` to resolve correct season
- **Admin** — Collection selectors on race/season creation forms

### Frontend Changes (Steps 12–16)

#### Types & Hooks (Step 12)
- `src/types/game.ts` — Added `collectionId?`, `collectionName?` to `Race` and `Season` interfaces; added `Collection` type
- `src/api/useCollections.ts` — **NEW**: Fetches all collections from `GET /api/v2/collections`
- `src/api/useSeasons.ts` — **NEW**: Fetches all active seasons (handles array/object response)
- `src/api/useGameConfig.ts` — Accepts optional `collectionId` parameter

#### CollectionFilter Component (Step 12)
- `src/components/ui/CollectionFilter.tsx` — **NEW**: Reusable toggle pill buttons ("All" + per-collection). Auto-hides when ≤1 collection
- `src/hooks/useCollectionFilter.ts` — **NEW**: State management hook (`active` set, `toggle()`, `matches()`)

#### Race Lobby (Step 13)
- `src/components/races/RaceCard.tsx` — Collection badge next to race type badge
- `src/pages/Races.tsx` — CollectionFilter pills, race lists filtered by collection
- `src/components/races/RaceEntryModal.tsx` — Creatures filtered by race's collection; collection-specific empty state

#### Dashboard (Step 14)
- `src/pages/Dashboard.tsx` — CollectionFilter pills, creature filtering, generic empty state ("No NFTs Found")

#### Leaderboard (Step 14)
- `src/pages/Leaderboard.tsx` — CollectionFilter pills, per-season leaderboard via collection→season mapping, collection badges on results

#### Wallet Ledger (Step 15)
- `api/v2/wallet/[address]/ledger.ts` — Each entry now includes `collectionId`/`collectionName` via `season_id` → `seasons.collection_id` join; `prizePools[]` array with per-collection prize pool data
- `src/pages/WalletLedger.tsx` — CollectionFilter fully wired: summary cards (Burned, Prize Pool, Activity) recompute from filtered entries; transaction list filtered with collection badges per entry
- `src/types/game.ts` — Added `collectionId`/`collectionName` to `LedgerEntry`; added `CollectionPrizePool` type and `prizePools` to `WalletLedger`

#### Training Center
- `src/pages/Train.tsx` — CollectionFilter pills on creature selection view, creatures filtered by collection

#### FAQ (Per-Collection)
- `src/pages/FAQ.tsx` — Collection pill selector (CyberPets default, no "All"). Collection-specific sections: The Basics, How Base Stats Are Created (trait mapping, rarity tiers, stat budgets, examples), Focus source, rarity badges. Shared sections: Stats, Training, Fatigue/Sharpness, Race Types, Scoring, Race Entries, Rewards, Seasons, Blockchain. Aneta Angels includes on-chain verification FAQ

### Aneta Angels Data & DB (Step 16)
- `scripts/convert-aneta-traits.ts` — Converts scored data to loader format (4406 tokens)
- `data/ergo/aneta-angels/aneta_angel_traits.json` — Token data with traits, rarity, normalized scores, and IPFS URLs
- `migrations/011_aneta_angels_collection.sql` — DB collection row with `base_stat_template` (6 tiers), `trait_mapping` (Wings→SPD, Body→STM, Face→HRT, Head→ACC, Background→AGI, Skin Tone→Focus)

### Aneta Angels Image Resolution
IPFS URLs pulled from Ergo blockchain R9 register (via local indexed node), stored in trait data as `ipfsUrl` field per token. Image chain:
1. **Primary**: IPFS gateway URL (e.g. `http://ipfs.io/ipfs/Qm...`) — from `metadata.ipfsUrl`
2. **Fallback**: ergexplorer nftcache (`https://api.ergexplorer.com/nftcache/{token_id}`) — via `PetImage` `onError`

### DB Migrations
- `migrations/010_game_config_overrides.sql` — Added `game_config_overrides` JSONB column to `collections` table
- `migrations/011_aneta_angels_collection.sql` — Aneta Angels collection row

### Phase 2 Compatibility
Collection loaders, registry, and per-collection config are purely backend architecture. Smart contracts don't need collection awareness — each collection's creatures are distinguished by their token IDs in the AVL tree. The loader system will continue to run in the TX builder service for proof generation. Frontend collection filter is purely UI — no on-chain impact.

---

## Bonus Action Cooldown Bug Fix (2026-02-13)

### Problem
After using a bonus action (earned from 1st place), the remaining 2 regular daily actions were blocked by a false cooldown timer. The dashboard and creature screens showed "Cooldown active — 5h 59m remaining" even though the player had never used a regular action that day.

### Root Cause
Bonus actions bypass cooldown for themselves, but the training endpoint still set `last_action_at = now` on the `creature_stats` row. When the next regular action was attempted, the cooldown check in `validateTrainingAction()` saw the recent `last_action_at` timestamp (from the bonus action) and blocked it. The same logic in `computeCreatureResponse()` caused the frontend to display a false cooldown timer.

### Fix
Cooldown checks now query `training_log` for the most recent **regular** (non-bonus) action instead of using `stats.last_action_at` (which includes bonus actions). `last_action_at` continues to update for all actions (needed for condition decay timing).

### Files Changed
- `lib/training-engine.ts` — `validateTrainingAction()` cooldown check queries `training_log` for last regular action instead of `stats.last_action_at`
- `api/_lib/helpers.ts` — Added `getLastRegularActionAt()` helper; `computeCreatureResponse()` accepts `lastRegularActionAt` param for cooldown display
- `api/v2/creatures/[id]/index.ts` — Fetches and passes `lastRegularActionAt`
- `api/v2/creatures/by-wallet/[address].ts` — Derives last regular action timestamp from existing training_log query (no extra DB call)

### Phase 2 Compatibility
On-chain equivalent: two separate registers — `lastRegularActionHeight` (for cooldown enforcement) and `lastActionHeight` (for condition decay). Contract checks `HEIGHT >= lastRegularActionHeight + 180` for cooldown, ignoring bonus action height.

---

## Wallet Display Names (2026-02-13)

### Overview
Users can set a friendly display name for their wallet (e.g. "Andrius") that appears on the leaderboard, race podium, and race results instead of a truncated wallet address. Names are unique (case-insensitive), 2-20 characters. The wallet button is now a dropdown with "Set Display Name" and "Disconnect" options.

### DB Migration (`migrations/009_wallet_profiles.sql`)
```sql
CREATE TABLE wallet_profiles (
  address       TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_wallet_profiles_display_name_lower
  ON wallet_profiles (LOWER(display_name));
```

### API
- `GET /api/v2/wallet/:address/profile` — Returns `{ address, displayName }` (null if not set)
- `PUT /api/v2/wallet/:address/profile` — Set/clear display name. Body: `{ walletAddress, displayName }`. Returns 409 if name taken.
- Leaderboard + race results APIs batch-fetch display names and include `ownerDisplayName` in responses

### Files Changed
- `migrations/009_wallet_profiles.sql` — **NEW**: Wallet profiles table with unique name index
- `api/v2/wallet/[address]/profile.ts` — **NEW**: GET/PUT endpoint for display names
- `api/v2/leaderboard.ts` — Batch-fetches display names, returns `ownerDisplayName`
- `api/v2/races/[id]/results.ts` — Same enrichment for race results
- `src/types/game.ts` — Added `ownerDisplayName` to `LeaderboardEntry` and `RaceEntry`, added `WalletProfile` type
- `src/api/useWalletProfile.ts` — **NEW**: `useWalletProfile()` query + `useUpdateWalletProfile()` mutation
- `src/api/index.ts` — Exported new hooks + type
- `src/components/layout/WalletConnect.tsx` — Connected state is now a dropdown menu with name display, edit dialog, disconnect
- `src/pages/Leaderboard.tsx` — Owner column shows display name (regular font) or truncated address (mono font)
- `src/components/races/Podium.tsx` — Shows display name or truncated address (was showing full raw address)

### Phase 2 Compatibility
Wallet display names are purely off-chain — stored in `wallet_profiles` table, never referenced by smart contracts. The off-chain indexer can `LEFT JOIN wallet_profiles` to enrich API responses. TX builder constructs transactions by address only. Zero impact on contract design, AVL trees, or on-chain state.

---

## Image Caching Proxy & Fallback (2026-02-12)

### Problem
CyberPet images were loaded directly from `api.ergexplorer.com/nftcache/` — an external service that frequently returns 404s (as seen in the screenshot for pet #146). Broken images degraded the UI experience.

### Solution: Three-Layer Resilience
1. **Caching proxy** — All image URLs point to our own domain. CyberPets: `/api/v2/img/[number]` (ergexplorer → cyberversewiki fallback). Aneta Angels: `/api/v2/img/token/[tokenId]` (IPFS HTTPS-upgraded → ergexplorer fallback). Both set `Cache-Control: public, s-maxage=31536000, max-age=31536000, immutable` for Vercel CDN edge + browser caching.
2. **Client-side fallback** — `<PetImage>` component tries the proxy URL; on `onError`, swaps to fallback URL directly.
3. **Collection-aware loaders** — All API endpoints (`creatures/[id]`, `leaderboard`, `wallet/ledger`, `creatures/by-wallet`) pass the correct collection loader for image/name resolution. Previously `creatures/[id]` and `leaderboard` were missing loaders, causing Aneta Angels to get CyberPets-style URLs.

### Performance Benefits
- **CDN edge caching**: After first load, images served from Vercel's 300+ PoPs — no origin hit
- **No cross-origin overhead**: Same-domain requests eliminate extra DNS lookups, TLS handshakes, CORS
- **Immutable browser cache**: Once loaded, pet images cached locally for 1 year
- **Invisible failover**: If ergexplorer is slow/down, proxy falls through to cyberversewiki before returning to client

### New Endpoint

| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /api/v2/img/:number` | `api/v2/img/[number].ts` | CyberPets image proxy — ergexplorer → cyberversewiki, 1yr CDN edge cache |
| `GET /api/v2/img/token/:tokenId` | `api/v2/img/token/[tokenId].ts` | Token image proxy — IPFS (HTTPS) → ergexplorer, 1yr CDN edge cache |

### Files Changed
- `api/v2/img/[number].ts` — CyberPets image proxy (fixed double `.png.png`, added `s-maxage`)
- `api/v2/img/token/[tokenId].ts` — **NEW**: Generic token image proxy (Aneta Angels IPFS → ergexplorer fallback)
- `api/_lib/collections/aneta-angels.ts` — `getImageUrl()` routes through proxy instead of direct IPFS URLs
- `api/v2/creatures/[id]/index.ts` — Now looks up and passes collection loader (was `undefined`)
- `api/v2/leaderboard.ts` — Now looks up and passes collection loaders per creature
- `api/v2/wallet/[address]/ledger.ts` — Returns `creatureName`, `creatureImageUrl`, `creatureFallbackImageUrl`, `seasonName` per entry
- `src/pages/WalletLedger.tsx` — Transaction rows show creature image + name, season name pill
- `vercel.json` — `includeFiles` now bundles `data/ergo/aneta-angels/**` alongside cyberpets
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
- `api/v2/admin/seasons/end.ts` — Records `season_payout` entries
- `api/v2/wallet/[address]/ledger.ts` — **NEW**: Wallet ledger endpoint
- `src/api/useWalletLedger.ts` — **NEW**: Frontend hook
- `src/types/game.ts` — Added `LedgerEntry`, `WalletLedger` types

### Phase 2 Note
Credit ledger entries map directly to on-chain TX fees. When real ERG transactions are enforced, the ledger becomes a read cache indexed from chain TXs. Historical shadow data provides fee calibration benchmarks. Per-race payouts are intentionally excluded — individual races award boosts only; ERG payouts happen at season end via `season_payout` entries.

**On-chain TX structure (NOW implemented for Nautilus, Phase 2 extends to SC):** Outputs use registers for scanner identification:
- R4: action type (`"train"`, `"race"`, `"season_payout"`)
- R5: creature token ID (32 bytes — the on-chain NFT identifier)
- R6: context (activity key for training, race ID for entry, pool type for payouts)

Scanner monitors treasury address, reads registers, inserts into `credit_ledger` with `shadow=false` + `tx_id`. Frontend/API stay identical — only data ingestion changes. **Registers are already being written to treasury boxes in Phase 1** via sigma-serialized `Coll[Byte]` values.

---

## TX Processing — Real ERG Payments (2026-02-14)

### Overview
Full TX processing pipeline: frontend builds unsigned TX → Nautilus signs/submits → backend validates `tx_id` and executes game action. ErgoPay path: backend creates payment request → mobile wallet pays → backend polls and executes on confirmation.

### Treasury Box Registers (On-Chain Traceability)
Every payment box at the treasury address is self-documenting via registers:

| Register | Type | Training Example | Race Entry Example |
|----------|------|------------------|--------------------|
| R4 | `Coll[Byte]` | `"train"` | `"race"` |
| R5 | `Coll[Byte]` | NFT token ID (32 bytes) | NFT token ID (32 bytes) |
| R6 | `Coll[Byte]` | `"agility_course"` | Race UUID |

Sigma serialization: `0x0e` (SColl[SByte]) + VLQ length + raw bytes.

### Nautilus Flow
1. Frontend reads `gameConfig.requireFees` + `gameConfig.treasuryErgoTree` from `/api/v2/config`
2. User clicks "Pay & Train (0.01 ERG)" → `buildAndSubmitEntryFeeTx()` constructs unsigned TX with UTXO selection, treasury output (with R4-R6 registers), change output, miner fee
3. Nautilus signs + submits → returns `txId`
4. Frontend calls backend with `txId` → backend validates and executes action
5. `credit_ledger` records `shadow=false`, `tx_id = <txId>`

### ErgoPay Flow (Reduced TX with Registers)
1. Frontend calls `POST /api/v2/ergopay/tx/request` with action details
2. Backend validates action, generates request ID, inserts `ergopay_tx_requests` row (status: pending)
3. Backend fetches sender's UTXOs from Explorer API, builds unsigned TX with treasury output (R4-R6 registers), POSTs to `ergopay.duckdns.org/api/v1/reducedTx` with `replyTo` callback URL
4. Frontend shows `ErgoPayTxModal` with QR code (desktop) / deep-link (mobile) + polling spinner
5. Mobile wallet signs + broadcasts TX → wallet POSTs `{ signedTxId }` to `replyTo` callback (`/api/v2/ergopay/tx/callback/[requestId]`)
6. Backend `status/[requestId].ts` detects payment via: (a) callback-stored `signed_tx_id` in DB, or (b) blockchain fallback (mempool + confirmed TXs)
7. Backend locks row, executes game action (training or race entry)
8. Frontend receives success callback with result

### Fee Gate
When `REQUIRE_FEES=true`, `train.ts` and `enter.ts` return HTTP 402 if no `txId` provided. Frontend branches: alpha (no fees) → Nautilus (build TX) → ErgoPay (payment session).

### DB Changes
- `credit_ledger` — Added `tx_id TEXT` column + `shadow BOOLEAN DEFAULT true`
- `ergopay_tx_requests` — New table for payment lifecycle tracking (pending → executing → executed/expired/failed)

### Environment Variables
- `TREASURY_ADDRESS` — Receiving address for fee payments
- `TREASURY_ERGO_TREE` — Hex-encoded ergoTree (sent to frontend for TX building)
- `REQUIRE_FEES` — `"true"` enables real ERG payments

### Files Changed
- `src/lib/ergo/transactions.ts` — `TxMetadata` interface, sigma serialization (`sigmaSerializeCollByte`, `sigmaSerializeUtf8`, `sigmaSerializeHex`), `buildRegisters()`, `buildAndSubmitEntryFeeTx()` accepts optional metadata
- `src/context/WalletContext.tsx` — `buildAndSubmitEntryFee` accepts optional `TxMetadata`
- `src/pages/Train.tsx` — Passes `{actionType: 'train', tokenId, context: activityId}` to TX builder; fixed Rules of Hooks violation (moved `useCallback` hooks before early returns)
- `src/pages/Races.tsx` — Passes `{actionType: 'race', tokenId, context: raceId}` to TX builder
- `src/components/training/TrainingConfirmModal.tsx` — Shows "Pay & Train (0.01 ERG)" when `requireFees`
- `src/components/races/RaceEntryModal.tsx` — Shows ERG amounts when `requireFees`, ErgoPay multi-entry note
- `api/v2/train.ts` — 402 fee gate, accepts `txId`
- `api/v2/races/[id]/enter.ts` — 402 fee gate, accepts `txId`
- `api/_lib/execute-action.ts` — Shared training/race entry executor (used by API + ErgoPay)
- `api/_lib/ergo-tx-builder.ts` — **NEW**: Server-side sigma serialization, UTXO fetching (Explorer API), unsigned TX builder with R4-R6 registers
- `api/v2/ergopay/tx/request.ts` — Create ErgoPay payment request via `POST /api/v1/reducedTx` (builds unsigned TX with registers, includes `replyTo` callback)
- `api/v2/ergopay/tx/callback/[requestId].ts` — **NEW**: Wallet callback endpoint — receives `{ signedTxId }` from wallet after signing
- `api/v2/ergopay/tx/status/[requestId].ts` — Poll + execute on payment confirmation (callback detection + blockchain fallback)
- `src/lib/ergo/ergopay-tx.ts` — Frontend ErgoPay TX request/poll helpers
- `src/components/ergopay/ErgoPayTxModal.tsx` — QR + polling + status modal
- `api/_lib/constants.ts` — `TRAINING_FEE_NANOERG`, `TREASURY_ADDRESS`, `TREASURY_ERGO_TREE`, `REQUIRE_FEES`
- `migrations/012_ergopay_tx_requests.sql` — Payment request tracking table

### Verified On-Chain
**Nautilus** — First real training fee TX: `113ca60b1c228b204e8dfba400c88d8c9c7ccc4e3aa89c350a77f2a1267599eb`
- 0.01 ERG → treasury (`9gbgJTNX...C3vm`)
- All tokens returned in change box
- `credit_ledger`: `shadow=false`, `tx_id` linked, `training_log_id` linked

**ErgoPay (mobile)** — First reduced TX with registers: `a0480c884c301ecfd9b83da2694329495d1d752a0b931651599a2af544c9e5b2`
- 0.01 ERG → treasury with R4-R6 registers
- ergexplorer box shows: R4: `train`, R5: `dbf0c1e2826c7bc3d2d5b17c3354471f9271eed04d06ee0fafbc468efc46d4f9`, R6: `mental_prep`
- Mobile wallet signing screen shows all 3 boxes + register values (Base64-encoded Coll[Byte])
- Training action executed successfully via callback + polling

### Phase 2 Compatibility
Treasury box registers (R4-R6) are already written in Phase 1. When Phase 2 scanner arrives, it reads existing boxes to index game actions. The transition from "API writes credit_ledger" to "scanner writes credit_ledger" requires zero schema changes — only the data ingestion pipeline changes.

---

## Season Payout Views + Public Seasons Page + Earnings Accuracy (2026-02-19)

### Overview
Three related features: admin payout breakdown views for completed seasons, a public-facing Seasons page, and an earnings accuracy fix to properly separate real from free-play shadow earnings.

### New Files
- `api/v2/seasons/index.ts` — Public `GET /api/v2/seasons` endpoint (active + completed, optional `?status=`/`?collectionId=` filters)
- `api/v2/admin/seasons/[seasonId]/payouts.ts` — Admin endpoint returning full payout breakdown: 3 pool totals (wins 40%/places 35%/shows 25%), unique wallets, per-creature payout table with pool-level detail
- `src/pages/Seasons.tsx` — Public Seasons page with collection filter pills, active season cards, expandable past season rows with lazy-loaded leaderboard + real ERG earnings
- `src/api/useAllSeasons.ts` — Hook for `GET /api/v2/seasons`
- `src/components/dashboard/SeasonEarnings.tsx` — Dashboard card showing user's confirmed season earnings with per-creature pool breakdown
- `migrations/021_class_rarities_per_collection.sql` — Per-collection rarity class mapping in `game_config_overrides`
- `migrations/022_season_payout_index.sql` — Partial index on `credit_ledger(season_id, tx_type)` for payout queries

### Modified Files
- `api/v2/leaderboard.ts` — Earnings now computed from real payments only: per-race prizes cross-referenced with `credit_ledger` (non-shadow entries), plus season-end payouts. Falls back to `total_earnings_nanoerg` for pure free-play seasons.
- `api/v2/wallet/[address]/ledger.ts` — Extended with `seasonPayouts` aggregation (per-creature, per-pool breakdown)
- `api/v2/admin/seasons/end.ts` — Season-end payout logic records pool type in memo for downstream parsing
- `api/_lib/helpers.ts` — `totalEarnings` now uses only prestige `lifetime_earnings_nanoerg` (confirmed past-season earnings), excludes current season speculative amounts
- `src/types/game.ts` — New `SeasonPayoutCreature`, `SeasonPayoutsSummary` interfaces; extended `WalletLedger`
- `src/pages/Admin.tsx` — Expandable past seasons with lazy-loaded payout breakdown (pool cards + creature table)
- `src/pages/Dashboard.tsx` — Added `SeasonEarnings` component below `InvestmentSummary`
- `src/components/creatures/CreatureHeader.tsx` — ERG earnings display: `.toFixed(2)`, "ERG" label, hidden when zero
- `src/components/layout/Navigation.tsx` — Added Seasons to sidebar + mobile nav (Calendar icon)
- `src/App.tsx` — Added `/seasons` route
- `src/api/index.ts` — Added `useAllSeasons` export

### Admin Race History for Past Seasons (2026-02-20)
Extended the past seasons expandable view to show all races that ran during each season. When expanding a completed season, a "Races (N)" table now appears above the creature payout table showing every race with its name, type, rarity class (Open vs Rookie/Contender/Champion), entry count, status (color-coded: green=resolved, red=cancelled), and deadline date. Data is included in the existing payouts endpoint response (lazy-loaded on expand, cached).

**Modified Files:**
- `api/v2/admin/seasons/[seasonId]/payouts.ts` — Added `races[]` array to response: queries `season_races` by `season_id`, counts entries per race via `season_race_entries`, returns name/raceType/status/rarityClass/entryCount/maxEntries/entryDeadline/createdAt
- `src/pages/Admin.tsx` — Race history table in expanded past season section (between stats line and creature payout table)

### Key Design Decisions
- **Earnings accuracy**: `season_leaderboard.total_earnings_nanoerg` includes shadow (free-play) race prizes because `resolve-race.ts` distributes `entryFee × entries.length` regardless of payment type. Real earnings require cross-referencing `season_race_entries.payout_nanoerg` with `credit_ledger` to find races where at least one non-shadow `race_entry_fee` exists.
- **Creature profile earnings**: Shows only prestige (confirmed lifetime) earnings, not current season speculative amounts. Current season earnings are unknown until season ends and payouts are computed.
- **Season total**: Past season header shows actual total distributed ERG (computed from leaderboard entries once loaded), not the admin-set prize pool, since hybrid seasons have both a prize pool and real entry fee redistribution.

---

## Token Fee Support — Dual-Currency with Babel Boxes (2026-02-17)

### Overview
Per-collection dual-currency payment system. Collections can define a fee token (e.g. CYPX for CyberPets) alongside ERG. Players choose which currency to pay with via a toggle in all confirm modals. Token payments use Babel boxes (EIP-0031) so players need zero ERG — miner fee covered by pre-funded Babel box liquidity.

### Fee Schedule (CyberPets — CYPX)
Reference rate: 0.05 ERG = 187 CYPX (3,740 CYPX/ERG). Admin-set per season, no oracle.

| Action | ERG | CYPX |
|--------|-----|------|
| Training / Meditation | 0.01 | 37 |
| Race Entry (default) | 0.05 | 187 |
| Stim Pack | 0.005 | 19 |
| Cryo Pod | 0.01 | 37 |
| Full Reset | 0.02 | 75 |

### Architecture
- **Config source**: `collections.game_config_overrides` JSONB → `fee_token` object with `token_id`, `name`, `decimals`, `training_fee`, `default_race_entry_fee`, `treatment_fees`, `entry_fees` (nanoErg→token mapping)
- **Config endpoint**: `GET /api/v2/config?collectionId=` returns `feeToken` object (null if ERG-only collection)
- **Nautilus**: Client-side Babel TX via custom babel swap (`SConstant.from()` + manual `ErgoUnsignedInput`/`OutputBuilder`). Fleet SDK `BabelSwapPlugin` bypassed — its `isValidBabelContract` rejects on-chain boxes with `0x18c101` ErgoTree header.
- **ErgoPay**: Server-side Babel TX builder (`buildUnsignedTokenFeeTx` / `buildUnsignedBatchTokenFeeTx` in `ergo-tx-builder.ts`). Token-aware UTXO selection via `fetchAllUtxos()` + `selectBoxes()` — prioritizes boxes containing the required token, then adds ERG-only boxes if needed. Unsigned TX POSTed to `ergopay.duckdns.org/api/v1/reducedTx` relay (updated to handle context extensions + ErgoTree-based outputs). Verified on mainnet — 37 CYPX training fee paid via mobile wallet.
- **TX verification**: `verifyTokenTxOnChain()` checks token outputs to treasury via Explorer API
- **Credit ledger**: `fee_token_id` + `fee_token_amount` columns record which currency was used. `recordLedgerEntry()` MUST be `await`ed — Vercel serverless kills process after response, un-awaited inserts silently lost.
- **Health monitoring**: `/api/health` queries Babel boxes per collection, reports usable box count + liquidity
- **Default currency**: Both Nautilus and ErgoPay default to CYPX (token) when fee_token config exists
- **Race fee auto-calculation**: Admin sets custom `entryFeeToken` → ERG auto-calculated proportionally from rate (`default_race_entry_fee` / collection `entry_fee_nanoerg`). E.g., 500 CYPX → ~0.134 ERG.

### DB Migration (`migrations/020_token_fee_support.sql`)
```sql
ALTER TABLE season_races ADD COLUMN entry_fee_token BIGINT DEFAULT NULL;
ALTER TABLE credit_ledger ADD COLUMN fee_token_id TEXT DEFAULT NULL;
ALTER TABLE credit_ledger ADD COLUMN fee_token_amount BIGINT DEFAULT NULL;
ALTER TABLE ergopay_tx_requests ADD COLUMN payment_currency TEXT NOT NULL DEFAULT 'erg';
```

### Files Changed

**Backend:**
- `api/_lib/babel-discovery.ts` — **NEW**: Server-side Babel box discovery, selection, price extraction, sigma SInt serialization
- `api/_lib/ergo-tx-builder.ts` — Added `buildUnsignedTokenFeeTx()`, `buildUnsignedBatchTokenFeeTx()` with Babel box inputs; token-aware UTXO selection (`fetchAllUtxos()` + `selectBoxes()`)
- `api/_lib/verify-tx.ts` — Added `verifyTokenTxOnChain()` for token amount verification
- `api/_lib/constants.ts` — Added `MIN_TOKEN_BOX_NANOERG`
- `api/v2/config.ts` — Returns `feeToken` from merged collection config
- `api/v2/train.ts` — Token-aware fee gate + TX verification branch
- `api/v2/races/[id]/enter.ts` — Token-aware fee gate + TX verification branch
- `api/v2/races/[id]/enter-batch.ts` — Token-aware fee gate + TX verification branch
- `api/v2/treatment/start.ts` — Token-aware fee gate + TX verification branch
- `api/_lib/execute-action.ts` — `recordLedgerEntry()` calls now `await`ed (2 sites); token fee fields passed to ledger
- `api/_lib/execute-treatment.ts` — `recordLedgerEntry()` call now `await`ed
- `api/v2/ergopay/tx/request.ts` — Accepts `paymentCurrency`, builds token TXs when `'token'`, stores in `action_payload`. User-actionable error messages surfaced for insufficient tokens/funds/depleted Babel boxes.
- `api/v2/ergopay/tx/status/[requestId].ts` — Passes `paymentCurrency`/`feeTokenId`/`feeTokenAmount` to executors
- `api/v2/admin/races/create.ts` — Accepts `entryFeeToken` param; auto-calculates proportional ERG from config rate when no explicit ERG fee
- `api/v2/admin/races/update.ts` — Accepts `entryFeeToken` param
- `api/v2/admin/seasons/end.ts` — `recordLedgerEntry()` call now `await`ed
- `api/v2/races/index.ts` — Returns `entryFeeToken` in race mapping; limits bumped to 100/50
- `api/v2/races/[id]/enter.ts` — Fallback to `default_race_entry_fee` when `entryFeeToken` null
- `api/v2/races/[id]/enter-batch.ts` — Same fallback
- `api/v2/wallet/[address]/ledger.ts` — Returns `feeTokenId`/`feeTokenAmount`/`feeTokenName` per entry (name resolved from collection config)
- `api/health.ts` — Rewritten: Babel box monitoring per collection (box count, usable boxes, token price, health status)

**Frontend:**
- `src/lib/ergo/babel.ts` — **NEW**: Client-side Babel box discovery + selection
- `src/lib/ergo/transactions.ts` — Added `buildAndSubmitTokenFeeTx()`, `buildAndSubmitBatchTokenFeeTx()` using custom babel swap (manual `ErgoUnsignedInput`/`OutputBuilder`)
- `src/components/ui/PaymentSelector.tsx` — **NEW**: Token/ERG toggle component
- `src/components/training/TrainingConfirmModal.tsx` — PaymentSelector integration (Nautilus only), ERG formatting cleanup
- `src/components/training/TrainingResultModal.tsx` — `feeTokenName`/`feeTokenAmount` props for token fee display
- `src/components/races/RaceEntryModal.tsx` — PaymentSelector integration (Nautilus only), fallback to `default_race_entry_fee`
- `src/components/races/RaceEntryResultModal.tsx` — `feeTokenName`/`feeTokenAmount` props for token fee display
- `src/components/races/RaceCard.tsx` — Shows token fee (e.g., "500 CYPX") when `entryFeeToken` set, accepts `feeToken` prop
- `src/pages/Treatment.tsx` — PaymentSelector integration (Nautilus only), ERG formatting cleanup
- `src/pages/Train.tsx` — Token TX branch + ErgoPay token params + `lastPaymentCurrency` state for result modal
- `src/pages/Races.tsx` — Token TX branch + ErgoPay token params + `lastPaymentCurrency` state + passes `feeToken` to RaceCard
- `src/pages/Admin.tsx` — `entryFeeToken` field on race creation; removed `.slice(0,10)` on resolved races
- `src/pages/WalletLedger.tsx` — Shows `feeTokenName` (resolved from backend) instead of generic "TOKEN"
- `src/components/ergopay/ErgoPayTxModal.tsx` — Token amount display, ERG formatting cleanup
- `src/lib/ergo/ergopay-tx.ts` — `tokenAmount`/`tokenName` on `ErgoPayTxRequest`
- `src/context/WalletContext.tsx` — Added `buildAndSubmitTokenFee`
- `src/types/game.ts` — Added `FeeToken`, `PaymentCurrency`, extended `GameConfig`/`Race`/`LedgerEntry`

**New Dependency:**
- `@fleet-sdk/babel-fees-plugin` (EIP-0031 Babel box support for Fleet SDK TX builder)

### Pre-Requisite: Babel Box Creation
Token payments require at least one funded Babel box on-chain for the CYPX token. Babel box created and verified on mainnet. Explorer returns boxes with dual ErgoTree format (`0x10` compact or `0x18c101` with-size header) — babel-discovery searches both variants.

### Live Testing Fixes (2026-02-17)
Issues found and fixed during mainnet testing:

1. **`recordLedgerEntry()` not awaited** — Vercel serverless killed process after response, credit_ledger entries silently lost. Added `await` to all 4 call sites (`execute-action.ts` x2, `execute-treatment.ts`, `admin/seasons/end.ts`).
2. **Result modals showed ERG instead of CYPX** — `TrainingResultModal` and `RaceEntryResultModal` now accept `feeTokenName`/`feeTokenAmount` props, display "37 CYPX paid on-chain" when token payment used.
3. **Race entry modal missing CYPX toggle** — `race.entryFeeToken` null for races created before token feature. Fallback to `feeToken?.default_race_entry_fee` in `RaceEntryModal.tsx` + `Races.tsx` + backend `enter.ts`/`enter-batch.ts`.
4. **Default payment currency was ERG** — Changed to CYPX (token) for Nautilus when fee_token config exists. ErgoPay stays ERG-only.
5. **Wallet ledger showed "-37 TOKEN"** — Backend now builds `tokenIdToName` mapping from collection configs, returns `feeTokenName` per entry.
6. **Race entry built ERG TX when CYPX selected** — Parent handler in `Races.tsx` was missing the `entryFeeToken` fallback, so condition fell through to ERG. Fixed.
7. **ERG amounts showed trailing zeros** — Removed `.toFixed(4)` from all ERG displays (TrainingConfirmModal, Treatment, ErgoPayTxModal).
8. **ErgoPay 502 on token payments** — Babel swap TX structure (context extensions, ErgoTree outputs) incompatible with `ergopay.duckdns.org` relay. PaymentSelector hidden for ErgoPay, server-side guard rejects `paymentCurrency: 'token'`. **RESOLVED** — relay updated, guard removed, PaymentSelector re-enabled. See fix #12+.
9. **Race fee ERG/CYPX mismatch** — Admin setting `entryFeeToken: 500` left ERG at default 0.05. Now auto-calculates proportional ERG from config rate.
10. **RaceCard showed "credits" not token fee** — Now shows "500 CYPX" when `entryFeeToken` set, falls back to ERG.
11. **Races pagination** — Backend limits bumped from 20→100 (resolved) and 20→50 (cancelled). Admin `.slice(0,10)` on resolved races removed.

### ErgoPay Babel TX Fixes (2026-02-19)
ErgoPay relay (`ergopay.duckdns.org`) updated by partner to handle Babel swap TXs. Server-side token payment guard removed, PaymentSelector re-enabled for ErgoPay wallet type. Verified on mainnet — 37 CYPX training fee paid via mobile wallet.

12. **ErgoPay relay updated** — Partner added support for `input.extension` (context extensions) and `output.ergoTree` (script-based outputs). Both required for Babel swap TXs. Server-side guard in `ergopay/tx/request.ts` removed, PaymentSelector shown for all wallet types.
13. **Token-aware UTXO selection** — `fetchUtxos()` split into `fetchAllUtxos()` + `selectBoxes()`. Babel TXs require sender boxes containing the fee token — original ERG-only selection caused relay `NotEnoughTokensError`. New selection prioritizes token-bearing boxes, then adds ERG-only boxes if needed.
14. **ErgoTree bytes must be preserved exactly** — Initial attempt converted Babel ErgoTree from `0x18c101` (with-size) to `0x10` (compact) header. Babel contract checks `selfOutput.propositionBytes == SELF.propositionBytes` — changing header bytes broke the script ("Script reduced to false"). Fix: use `babelBox.ergoTree` directly from on-chain box, never re-encode.
15. **ErgoPay result banner showed ERG for token payments** — `handleErgoPaySuccess` callbacks in `Train.tsx` and `Races.tsx` now set `lastPaymentCurrency` based on `ergoPayTx?.tokenAmount` so "Payment Confirmed" banner shows "37 CYPX" instead of "0.01 ERG".
16. **User-actionable error messages** — `request.ts` catch block returns 400 (not 500) for `Insufficient tokens`, `Insufficient funds`, and `Babel fee boxes depleted` errors.

### Per-Collection Rarity Classes (2026-02-19)
Rarity-to-class mapping moved from hardcoded CyberPets-only constant to per-collection `game_config_overrides`. Each collection defines which rarity tiers belong to Rookie/Contender/Champion.

- **Migration 021**: `class_rarities` added to `game_config_overrides` for both collections
  - CyberPets: 3-3-3 (common/uncommon/rare | masterwork/epic/relic | legendary/mythic/cyberium)
  - Aneta Angels: 2-2-2 (common/uncommon | rare/epic | legendary/mythic)
- **Backend**: `getClassRaritiesFromConfig(config)` helper in `constants.ts` reads from merged config with fallback. Entry guard in `execute-action.ts` uses per-collection mapping. Admin `create.ts` validates class name only (tier-level validation at entry time).
- **Frontend**: `Rarity` type changed from hardcoded union to `string`. `getClassRarities(config)` resolver in `game.ts`. `RaceEntryModal` uses `useGameConfig(race.collectionId)` for per-collection filtering. Admin dropdown labels build dynamically from config — switching collections updates labels instantly.
- **Config endpoint**: `class_rarities` added to `api/v2/config.ts` allowlist (endpoint cherry-picks keys — new config keys must be explicitly added).

**Files changed:**
- `migrations/021_class_rarities_per_collection.sql` — NEW
- `api/_lib/constants.ts` — `getClassRaritiesFromConfig()` helper
- `api/_lib/execute-action.ts` — Config-based entry guard
- `api/v2/admin/races/create.ts` — Simplified validation
- `api/v2/config.ts` — `class_rarities` in response
- `src/types/game.ts` — `Rarity` → `string`, `getClassRarities()` resolver
- `src/api/useGameConfig.ts` — `class_rarities` in `GameConfig` interface
- `src/components/races/RaceEntryModal.tsx` — Per-collection filtering
- `src/pages/Admin.tsx` — Dynamic dropdown labels

### Testing Checklist
See [`TEST-token-fees.md`](TEST-token-fees.md) — 40+ items across 10 categories (pre-reqs, config, UI, Nautilus, ErgoPay, free-play, admin, ledger, TX verification, edge cases).

### Technical Reference
See [`Ergo-Pay-Update-Babel-Fees.md`](Ergo-Pay-Update-Babel-Fees.md) — comprehensive Babel payment documentation covering both Nautilus and ErgoPay flows, common pitfalls, box selection strategies, and sigma serialization details.

### Phase 2 SC Compatibility
- Season box R5 includes `feeTokenId: Option[Coll[Byte]]` + fee amounts — contracts read this to validate payments
- Training/race contracts check: if `feeTokenId.isDefined`, validate token amount in treasury output; else validate ERG amount
- Babel boxes are orthogonal to game contracts — separate input/output pair in TX, invisible to game logic
- Scanner reads treasury box tokens (not just ERG value) to index `credit_ledger` entries

---

## Security Audit — Full Hardening Pass (2026-02-16)

### Overview
Comprehensive 37-finding security audit across three sections: A (Security & Auth), B (Code Quality & DB Patterns), C (Mobile/UX). All critical, high, and medium findings addressed. Audit document: `PLAN-racing-audit-results.md`.

### Section A — Security & Auth (Batches 1–4)

**Batch 1 (Quick wins):**
- Timing-safe admin auth (`timingSafeEqual` in `api/_lib/auth.ts`)
- `CRON_SECRET` length warning on startup (minimum 32 chars)
- Input validation helpers: `isValidUUID()`, `isValidErgoAddr()`, `isValidTokenId()` in `api/_lib/validation.ts`
- ASCII-only wallet profile names (2-20 chars, no unicode exploits)
- Strict token/pet ID validation on all mutation endpoints
- Reduced ErgoPay session TTL from 5 to 2 minutes
- Increased ErgoPay requestId entropy from 5 to 16 bytes
- Runtime env var checks on all endpoints

**Batch 2 (TX validation):**
- **NEW** `api/_lib/verify-tx.ts` — `isTxIdUsed()` dedup via `credit_ledger` (prevents replaying same txId), `verifyTxOnChain()` Explorer-based amount verification (soft-fail on unavailability), `detectPaymentOnChain()` extracted + dedup-aware
- All 4 Nautilus endpoints (train, enter, enter-batch, treatment) + ErgoPay status/callback hardened with TX dedup + amount verification
- ErgoPay callback validates 64-char hex txId format

**Batch 3 (Infrastructure):**
- Security headers in `vercel.json`: `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (no camera/mic/geolocation)
- `resolve_at_height` column on `season_races` (migration 018) — records block height at resolution time for auditable RNG
- Auto-resolve limited to 3 races per page load (prevents DoS via accumulated expired races)

**Batch 4 (Rate limiting):**
- **NEW** `api/_lib/rate-limit.ts` — process-local in-memory rate limiter
- Applied to all 5 mutation endpoints: train (10/min), enter (10/min), enter-batch (10/min), treatment (10/min), ergopay-tx-request (20/min)
- Per-IP, per-action-type limiting with sliding window

### Section B — Code Quality & DB Patterns (Batches 5–7)

**Migration 019 (`migrations/019_audit_b_fixes.sql`):**
- B1-3: `ownership_verified_at` column on `creatures` table
- B3-1: 7 composite indexes for frequent query patterns (training log, race entries, boosts, ledger, leaderboard, recovery packs, TX dedup)
- B4-2: `check_race_capacity()` trigger — prevents TOCTOU race on entry count check → insert
- B4-3: `upsert_leaderboard_entry()` RPC with `ON CONFLICT` — atomic upsert eliminates read-then-write race condition
- B3-3: `get_wallet_balance()` RPC — `SUM(amount_nanoerg)` immune to concurrent insert ordering

**Code fixes:**
- B2-1: `CreatureRow` typed interface in `execute-action.ts` (replaces `as any`)
- B1-3: 24h ownership staleness check in `verifyCreatureOwnership()` — when Explorer API is unavailable, cached ownership expires after 24h. Updates `ownership_verified_at` on successful verification. Applied to both `execute-action.ts` and `execute-treatment.ts`
- B4-1/B1-2: Boost and recovery marking now throws `ActionError(500)` on failure (prevents double-spend via silent failure)
- B3-3: `recordLedgerEntry()` uses `.maybeSingle()` (handles empty result without error). `getWalletBalance()` uses SUM via RPC with JS fallback
- B3-2: Race resolution parallelized — entry updates via `Promise.all`, leaderboard via RPC upsert, recovery inserts as single batch. ~60 sequential queries → ~3 parallel calls for 22-entry races

**Research findings:**
- B5-1: 5 unused Radix UI packages identified (alert-dialog, aspect-ratio, context-menu, hover-card, navigation-menu) — safe to remove
- B5-2: `ergo-lib-wasm-nodejs` confirmed server-only (dynamic import in `lib/ergo/server.ts`, excluded from `tsconfig.app.json`) — no bundle impact
- B1-1: Reconciliation script (`scripts/reconcile-ledger.ts`) — cross-refs training_log, race_entries, treatment_log against credit_ledger; checks balance_after_nanoerg drift

### Section C — Mobile/UX (Easy Wins)

- C1-1: Landing page decorative blur responsive sizing (`w-[300px] h-[300px] md:w-[600px] md:h-[600px]`)
- C1-2: Podium component responsive layout — vertical stack on mobile (cards full-width, compact stands), side-by-side podium on desktop with 2nd-1st-3rd reordering
- C2-2: `PetImage` component: `loading="lazy"` + explicit `width={64} height={64}` dimensions
- C4-1: Leaderboard image alt text uses creature name instead of empty string

**Passed items (complex/breaking/N/A):** C1-2 podium animation (CSS only), C2-1 skeleton loaders (new component work), C2-3 staleTime (hooks use custom useState/useEffect, not React Query), C2-4 optimistic updates (architecture change), C3-1/C3-2 touch targets (already adequate), C4-2/C4-3 reduced motion/focus trapping (low impact), C5-1/2/3 meta tags/OG image/manifest (deployment-time).

### DB Migrations
- `migrations/018_resolve_at_height.sql` — `resolve_at_height` column on `season_races`
- `migrations/019_audit_b_fixes.sql` — Composite indexes, race capacity trigger, leaderboard upsert RPC, wallet balance RPC, ownership_verified_at column

### New Files
- `api/_lib/verify-tx.ts` — TX verification module (dedup + on-chain amount check)
- `api/_lib/rate-limit.ts` — Process-local rate limiter
- `scripts/reconcile-ledger.ts` — Ledger reconciliation script

### Files Modified
- `api/_lib/auth.ts` — Timing-safe comparison
- `api/_lib/execute-action.ts` — Typed `CreatureRow`, ownership staleness, boost/recovery throw-on-fail
- `api/_lib/execute-treatment.ts` — Same ownership staleness pattern
- `api/_lib/credit-ledger.ts` — `.maybeSingle()`, SUM-based balance via RPC
- `api/_lib/resolve-race.ts` — Parallel entry updates, RPC leaderboard upsert, batch recovery insert
- `api/v2/train.ts` — TX dedup, rate limiting, input validation
- `api/v2/races/[id]/enter.ts` — TX dedup, rate limiting, input validation
- `api/v2/races/[id]/enter-batch.ts` — TX dedup, rate limiting, input validation
- `api/v2/treatment/start.ts` — TX dedup, rate limiting, input validation
- `api/v2/ergopay/tx/request.ts` — Rate limiting, input validation
- `api/v2/ergopay/tx/status/[requestId].ts` — TX dedup in callback detection
- `api/v2/ergopay/tx/callback/[requestId].ts` — 64-char hex txId validation
- `vercel.json` — Security headers
- `src/pages/Landing.tsx` — Responsive blur sizing
- `src/components/races/Podium.tsx` — Responsive vertical/horizontal layout
- `src/components/creatures/PetImage.tsx` — Lazy loading + dimensions
- `src/pages/Leaderboard.tsx` — Alt text fix

---

## Rarity Class Races + Entry Modal UX Improvements (2026-02-15)

### Overview
Rarity-restricted races that group creatures by power tier, with fractional league points and recovery rewards. Plus three UX improvements to the race entry modal: treatment guard, already-entered guard, and floating point display fix.

### Rarity Classes
Three class tiers based on creature rarity:

| Class | Eligible Rarities | League Point Weight |
|-------|-------------------|---------------------|
| Rookie | Common, Uncommon, Rare | 1/7 (≈0.143×) |
| Contender | Masterwork, Epic, Relic | 1/7 (≈0.143×) |
| Champion | Legendary, Mythic, Cyberium | 1/7 (≈0.143×) |
| Open (default) | All rarities | 1× (full points) |

### League Points
Primary leaderboard ranking metric. Open races award 7/5/3/1 points by position. Class races apply a `class_weight` multiplier (default 1/7), giving 1/0.71/0.43/0.14 points. League points column is the primary sort on the leaderboard, with win count as tiebreaker.

### Recovery Rewards (UTXO-Style)
Class races award fatigue reduction packs instead of training boosts:

| Position | Fatigue Reduction |
|----------|-------------------|
| 1st | −8 fatigue |
| 2nd | −5 fatigue |
| 3rd | −4 fatigue |
| 4th+ | −3 fatigue |

Recovery rewards are discrete rows in `recovery_rewards` table. Consumed at training time — player selects which recovery packs to apply alongside boosts. Each pack subtracts its `fatigue_amount` from the creature's current fatigue.

### Rarity Case Normalization Fix
CyberPets JSON stores rarity as `"Common"` (capitalized) but all frontend type maps (`CLASS_RARITIES`, `rarityStyles`) use lowercase `"common"`. The backend `execute-action.ts` already lowercased for the entry guard, but the frontend comparison and API responses did not. Fixed by normalizing to lowercase at every layer:

- **Loader parse time**: `cyberpets.ts` and `aneta-angels.ts` now `.toLowerCase()` rarity values
- **API response layer**: `computeCreatureResponse()`, `leaderboard.ts`, `races/[id]/results.ts` all lowercase rarity
- **Frontend**: `RaceEntryModal` lowercases for `CLASS_RARITIES` comparison
- **Existing DB rows**: Run `UPDATE creatures SET rarity = LOWER(rarity) WHERE rarity != LOWER(rarity);`

### Race Entry Modal UX Improvements

**Treatment Guard** — Creatures currently in the Treatment Center are shown in the entry modal but disabled (opacity-50, cursor-not-allowed). A "In treatment" label with Clock icon appears. They are excluded from "Select All". Prevents wasted TX signatures on creatures the backend will reject.

**Already-Entered Guard** — New `GET /api/v2/races/:id/entries?wallet=ADDRESS` endpoint returns creature IDs already entered in a race. Modal shows these creatures as disabled with an "Already entered" label in cyan. Prevents duplicate entry attempts.

**Floating Point Fix** — `0.05 * 3 = 0.15000000000000002` was displayed in entry fee totals. Fixed with `roundFee()` helper using `Math.round(value * 1e8) / 1e8`. Also fixed nanoERG conversion in `Races.tsx` using `Math.round()`.

### DB Migration (`migrations/016_rarity_class_races.sql`)
```sql
-- Rarity class column on races
ALTER TABLE season_races ADD COLUMN rarity_class TEXT DEFAULT NULL;
ALTER TABLE season_races ADD COLUMN class_weight NUMERIC(10,6) DEFAULT NULL;

-- League points on leaderboard
ALTER TABLE season_leaderboard ADD COLUMN league_points NUMERIC(10,4) NOT NULL DEFAULT 0;

-- Recovery rewards table (UTXO-style fatigue packs)
CREATE TABLE recovery_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creature_id UUID NOT NULL REFERENCES creatures(id),
  season_id UUID NOT NULL REFERENCES seasons(id),
  race_id UUID NOT NULL REFERENCES season_races(id),
  fatigue_amount NUMERIC(5,2) NOT NULL,
  spent_at TIMESTAMPTZ DEFAULT NULL,
  spent_training_log_id UUID REFERENCES training_log(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Backend Constants (`api/_lib/constants.ts`)
```typescript
CLASS_RARITIES = {
  rookie: ['common', 'uncommon', 'rare'],
  contender: ['masterwork', 'epic', 'relic'],
  champion: ['legendary', 'mythic', 'cyberium'],
};
LEAGUE_POINTS_BY_POSITION = [7, 5, 3, 1];
RECOVERY_BY_POSITION = [8, 5, 4, 3];
DEFAULT_CLASS_WEIGHT = 1/7;
```

### Files Changed
- `migrations/016_rarity_class_races.sql` — **NEW**: Rarity class columns, league points, recovery rewards table
- `api/_lib/constants.ts` — `CLASS_RARITIES`, `LEAGUE_POINTS_BY_POSITION`, `RECOVERY_BY_POSITION`, `DEFAULT_CLASS_WEIGHT`
- `api/_lib/resolve-race.ts` — Applies `class_weight` to league points, inserts `recovery_rewards` rows for class races
- `api/_lib/execute-action.ts` — Race entry rarity guard (checks `race.rarity_class` vs creature rarity), accepts `recoveryRewardIds[]` for training, validates + consumes packs, subtracts fatigue
- `api/_lib/helpers.ts` — `computeCreatureResponse()` lowercases rarity, fetches `recoveries[]` array
- `api/_lib/collections/cyberpets.ts` — `parseCyberPetTraits()` lowercases rarity at parse time
- `api/_lib/collections/aneta-angels.ts` — `getRarity()` lowercases return value
- `api/v2/races/[id]/enter.ts` — Unchanged (delegates to `executeRaceEntry`)
- `api/v2/races/[id]/entries.ts` — **NEW**: Lightweight endpoint returning creature IDs entered by wallet
- `api/v2/races/[id]/results.ts` — Lowercases rarity in response
- `api/v2/leaderboard.ts` — Lowercases rarity, includes `leaguePoints` in response (primary sort)
- `api/v2/creatures/by-wallet/[address].ts` — Returns `recoveries[]` per creature
- `api/v2/creatures/[id]/index.ts` — Returns `recoveries[]`
- `api/v2/admin/races/create.ts` — Accepts `rarityClass` param, auto-sets `class_weight`
- `src/types/game.ts` — Added `rarityClass`, `classWeight`, `leaguePoints` to `Race`/`LeaderboardEntry`; `RecoveryReward` type
- `src/api/useRaces.ts` — Added `useRaceEntries` hook
- `src/api/index.ts` — Exported `useRaceEntries`
- `src/components/races/RaceCard.tsx` — Color-coded class badge (amber Rookie, violet Contender, cyan Champion)
- `src/components/races/RaceEntryModal.tsx` — Rarity class filtering, treatment guard, already-entered guard, floating point fix (`roundFee()`), `useRaceEntries` integration
- `src/pages/Races.tsx` — `Math.round()` for nanoERG conversion, rounded fee in result modal
- `src/pages/Leaderboard.tsx` — League points column (primary sort), `LP` header
- `src/pages/Admin.tsx` — Rarity class dropdown on race creation form

### Single-TX Batch Race Entry — IMPLEMENTED
Entering N creatures into a race now uses a single TX with N treasury output boxes (one per creature, each with its own R4-R6 registers). One wallet signature, one miner fee. See dedicated section below for full details.

### Phase 2 Compatibility
- `rarity_class` and `class_weight` columns carry forward — on-chain race creation can encode these in race config boxes
- `recovery_rewards` mirrors the UTXO model — each pack is a "box" with fatigue value, consumed as TX input when training
- `league_points` replaces simple win-count ranking — scanner can compute from on-chain race results
- `baseBudget: Short` in CreatureState AVL struct enables on-chain rarity verification for class race entry guards

---

## Single-TX Batch Race Entry (2026-02-15)

### Overview
Entering N creatures into a race previously required N separate wallet signatures — one TX per creature, each paying its own miner fee (0.0011 ERG). For players with 6-10+ NFTs, this meant 6-10 sign popups and 6-10× miner fees. Now consolidated into a single TX with N treasury output boxes, one wallet signature, and one miner fee.

### TX Structure: N Output Boxes
Each creature gets its own treasury output box with independent R4-R6 registers:

| Output | Value | R4 | R5 | R6 |
|--------|-------|----|----|-----|
| Treasury box 1 | `entryFee` | `"race"` | creature 1 token ID | race UUID |
| Treasury box 2 | `entryFee` | `"race"` | creature 2 token ID | race UUID |
| Treasury box N | `entryFee` | `"race"` | creature N token ID | race UUID |
| Change box(es) | remainder | — | — | — |
| Fee box | 0.0011 ERG | — | — | — |

Why N boxes (not 1 aggregated box): each box is independently self-documenting on-chain, consistent with existing register schema, no complex `Coll[Coll[Byte]]` encoding needed, and each maps cleanly to a credit_ledger row.

### Nautilus Flow
1. Frontend calls `buildAndSubmitBatchEntryFeeTx(entries, treasuryErgoTree)` — builds single unsigned TX with N treasury outputs
2. Nautilus shows **one** sign popup (user sees N output boxes + miner fee)
3. Returns single `txId`
4. Frontend calls `POST /api/v2/races/:id/enter-batch` with `{ creatureIds, walletAddress, txId }`

### ErgoPay Flow
1. Frontend calls `POST /api/v2/ergopay/tx/request` with `{ actionType: 'race_entry_fee', creatureIds: [...], raceId, walletAddress }`
2. Backend validates all creatures, builds batch unsigned TX via `buildUnsignedBatchTx()`, stores `creatureIds` array in `action_payload`
3. POSTs to `ergopay.duckdns.org/api/v1/reducedTx` — single QR/deep-link
4. On payment confirmation, `status/[requestId].ts` loops `executeRaceEntry()` for each creature ID from `action_payload.creatureIds`

### Alpha Mode (No Fees)
Frontend calls `POST /api/v2/races/:id/enter-batch` with `{ creatureIds, walletAddress }` — no txId, batch endpoint processes all entries.

### Batch Endpoint
`POST /api/v2/races/:id/enter-batch` — all-or-nothing pre-validation:
- Race must be open, not past deadline, have capacity for all N entries
- All creatures validated: ownership, collection match, rarity class match, not already entered
- If any creature fails: entire batch rejected with specific error
- On success: loops `executeRaceEntry()` for each creature, all sharing same `txId`
- Returns `{ success, entries: [{ creatureId, entryId }...], errors?: [...] }`

### On-Chain Payment Detection (ErgoPay)
Updated `detectPaymentOnChain()` to sum all TX outputs to treasury address (was checking for single-output exact match). Now works for both single and batch TXs:
```
totalToTreasury = sum of all outputs where address === treasuryAddress
match = totalToTreasury >= expectedAmountNanoerg
```

### Files Changed
- `src/lib/ergo/transactions.ts` — Added `buildAndSubmitBatchEntryFeeTx()` (N treasury outputs, shared UTXO selection, whale wallet overflow handling)
- `api/v2/races/[id]/enter-batch.ts` — **NEW**: Batch entry endpoint with all-or-nothing validation
- `api/_lib/ergo-tx-builder.ts` — Added `buildUnsignedBatchTx()` (server-side N-output TX for ErgoPay)
- `api/v2/ergopay/tx/request.ts` — Extended `race_entry_fee` to accept `creatureIds[]` array, validate all creatures, build batch TX
- `api/v2/ergopay/tx/status/[requestId].ts` — Batch execution (loop over `action_payload.creatureIds`), updated `detectPaymentOnChain()` to sum outputs
- `src/pages/Races.tsx` — Replaced per-creature for-loop with single batch call (Nautilus, ErgoPay, alpha)
- `src/api/useRaces.ts` — Added `useEnterRaceBatch()` hook
- `src/api/index.ts` — Exported `useEnterRaceBatch`
- `src/types/game.ts` — Added `EnterRaceBatchResponse` type
- `src/lib/ergo/ergopay-tx.ts` — Made `creatureId` optional, added `creatureIds?: string[]` to request params
- `src/components/races/RaceEntryModal.tsx` — Updated ErgoPay hint: "one payment for all creatures"

### No DB Migrations Needed
`credit_ledger` and `season_race_entries` already support multiple rows with the same `tx_id`. `ergopay_tx_requests.action_payload` is JSONB and already stores `creatureIds` array.

### Verified On Mainnet
Nautilus: 2 creatures entered in a single TX — Nautilus popup showed 2 × 0.05 ERG treasury outputs + 0.0011 ERG miner fee. Result modal showed "2 creatures entered" with single txId.

### Phase 2 SC Compatibility
Batch entry is **better** in Phase 2:
- Reduces UTXO contention on race boxes — only 1 TX spends a given race box UTXO per block, so batching N entries into 1 TX is more efficient than N separate TXs competing for the same race box
- AVL Plasma service can generate a single proof covering N creature stat lookups
- Race Entry Contract validates all N entries in one TX: ownership via signing key, stats via AVL tree proof, snapshots appended to R5 (`Coll[Coll[Byte]]`)
- The Phase 1 "N treasury output boxes" pattern doesn't carry forward directly (Phase 2 spends race boxes, not treasury), but the UX pattern (select N creatures → one sign → all entered) is identical
- Backend batch endpoint (`enter-batch.ts`) can be adapted to build a single race-box-spending TX with N snapshot appends

---

## UI Polish & Bug Fixes (2026-02-21)

### Race Entry Fee Fix (Critical)
Admin race creation endpoints (`create.ts`, `batch-create.ts`, `generate-schedule.ts`) were querying a non-existent `collections.entry_fee_nanoerg` column, causing all races to be created with 0 ERG entry fee. Fixed to read from `getGameConfig(collectionId).default_race_entry_fee_nanoerg`. Migration 024 adds `default_race_entry_fee_nanoerg: 50000000` (0.05 ERG) to `game_config_overrides` for both collections and patches existing open races.

### Dynamic Prize Pool
`seasons.prize_pool_nanoerg` was a static column never updated after season creation. Prize pool is now computed dynamically from `credit_ledger` by summing all fee types (`training_fee`, `race_entry_fee`, `treatment_fee`). `SeasonBanner` shows both ERG and CYPX totals. Added `prizePoolToken` and `prizePoolTokenName` to `Season` type.

### Batch Training UX
- **MiniStatBars** — New `MiniStatBars.tsx` component: 6 colored vertical bars per creature showing current stat levels. Per-bar hover dims other bars and shows stat label + value.
- **Activity stat dots** — Colored dots under each activity column header (bigger = primary stat, smaller = secondary). CSS `group-hover` tooltip shows "+3 speed, +1 acceleration" etc.
- **Radio toggle-off** — Clicking an already-selected activity radio deselects it.
- **Stats header** — "Stats" label in creature column header aligned near stat bars.

### History-Based Back Navigation
All internal "Back" buttons now use `navigate(-1)` (browser history) instead of hardcoded routes. Affected files: `Train.tsx`, `Treatment.tsx`, `RaceResults.tsx`, `CreatureHeader.tsx`.

### Files Changed
- `migrations/024_default_race_entry_fee_nanoerg.sql` — **NEW**
- `api/v2/admin/races/create.ts` — Fee from game config
- `api/v2/admin/races/batch-create.ts` — Fee from game config
- `api/v2/admin/races/generate-schedule.ts` — Fee from game config
- `api/v2/seasons/current.ts` — Dynamic prize pool from credit_ledger
- `src/components/layout/SeasonBanner.tsx` — ERG + CYPX display
- `src/types/game.ts` — `prizePoolToken`, `prizePoolTokenName` on Season
- `src/components/creatures/MiniStatBars.tsx` — **NEW**: Inline stat bars
- `src/components/training/BatchTrainingView.tsx` — Stat bars, stat dots, radio toggle, stat header
- `src/pages/Train.tsx` — `navigate(-1)` back button
- `src/pages/Treatment.tsx` — `navigate(-1)` back button
- `src/pages/RaceResults.tsx` — `navigate(-1)` back button
- `src/components/creatures/CreatureHeader.tsx` — `navigate(-1)` back button

---

## Single-TX Batch Training (2026-02-21)

### Overview
Training N creatures previously required N separate wallet signatures — one TX per creature. Batch training consolidates into a single TX with N treasury output boxes (same pattern as batch race entry), one wallet signature, and one miner fee. Max 20 creatures per batch, all must be from the same collection (same fee config).

### TX Structure: N Output Boxes
Each creature gets its own treasury output box with independent R4-R6 registers:

| Output | Value | R4 | R5 | R6 |
|--------|-------|----|----|-----|
| Treasury box 1 | `trainingFee` | `"train"` | creature 1 token ID | activity (e.g. `"sprint_drills"`) |
| Treasury box 2 | `trainingFee` | `"train"` | creature 2 token ID | activity (e.g. `"agility_course"`) |
| Treasury box N | `trainingFee` | `"train"` | creature N token ID | activity |
| Change box(es) | remainder | — | — | — |
| Fee box | 0.0011 ERG | — | — | — |

Per-creature activities — each creature can have a different activity (unlike batch race entry where context is always the raceId).

### Frontend UI — Grid Matrix
`BatchTrainingView` component with:
- **Default activity pills** — pre-select a column for all creatures (per-creature radio overrides)
- **Grid radio matrix** — one row per creature, one radio per activity column (Sprint/Dist/Agility/Gate/Cross/Mental/Meditate). Radio buttons toggle off when clicking already-selected activity.
- **Inline MiniStatBars** — colored vertical bars (SPD/STA/ACC/AGI/HRT/FOC) per creature row, with per-bar hover that dims other bars and shows stat label + current value
- **Activity stat dot indicators** — colored dots under each activity column header. Larger dot = primary stat, smaller = secondary. CSS hover tooltip shows gain details (e.g. "+3 speed, +1 acceleration")
- **Auto-apply all boosts** — global toggle, boost `▲` indicator per creature shows total multiplier
- **Expandable detail rows** — click creature to see/override individual boost toggles, recovery packs, stat preview
- **Disabled rows** — creatures in treatment, on cooldown, or with no actions remaining shown greyed out
- **Select All / Deselect All** checkbox
- **Same-collection guard** — warning banner when mixed collections detected
- **Payment summary** — `N × fee = total` with ERG/CYPX toggle

### Batch Endpoint
`POST /api/v2/train-batch` — partial success model (207):
- Rate limited: 10 req/min/IP
- All creatures must be same collection
- Max 20 creatures per batch
- TX verification: `isTxIdUsed()` + `verifyTxOnChain()` / `verifyTokenTxOnChain()` for total amount
- Loops `executeTraining()` per creature — partial success returns 207 with mixed results/errors
- Returns `{ success, partial?, results: [{ creatureId, result }], errors?: [{ creatureId, error }] }`

### ErgoPay Flow
- `request.ts` extended `training_fee` branch: accepts `creatures[]` array, pre-validates ALL atomically (reject entire batch on any failure)
- `status/[requestId].ts` batch execution: loops `executeTraining()` for each creature from `action_payload.creatures`
- Reuses existing `buildUnsignedBatchTx()` / `buildUnsignedBatchTokenFeeTx()` for N treasury outputs

### Files Changed
- `api/v2/train-batch.ts` — **NEW**: Batch training endpoint
- `src/components/training/BatchTrainingView.tsx` — **NEW**: Grid matrix UI
- `src/components/training/BatchTrainingResultModal.tsx` — **NEW**: Per-creature result display
- `api/v2/ergopay/tx/request.ts` — Extended training_fee for batch creatures array
- `api/v2/ergopay/tx/status/[requestId].ts` — Batch training execution path
- `src/pages/Train.tsx` — Batch mode toggle, submission flows (Nautilus ERG/CYPX + ErgoPay)
- `src/api/useTraining.ts` — Added `useTrainBatch()` hook
- `src/api/index.ts` — Exported `useTrainBatch`
- `src/types/game.ts` — Added `BatchTrainCreatureInput`, `BatchTrainResponse` types
- `src/lib/ergo/ergopay-tx.ts` — Added `creatures?` param to ErgoPay request

### Verified
- **Nautilus CYPX**: 4 creatures × 37 CYPX = 148 CYPX — 4 treasury outputs with correct R4/R5/R6, different activities per creature (sprint_drills, distance_runs, agility_course). Single Babel box consumed.
- **Nautilus ERG**: 2 creatures × 0.01 ERG — confirmed on mainnet.
- **ErgoPay CYPX**: 3 creatures × 37 CYPX = 111 CYPX — verified on live preview branch via mobile wallet.
- **Collection mismatch**: Mixed CyberPets + Aneta Angels correctly rejected.
- **Insufficient tokens**: Human-readable error ("Insufficient tokens: need 740012 raw units, wallet has 329960").
- **Cooldown/no-actions**: UI disables rows — cannot select ineligible creatures.

### Phase 2 SC Compatibility
Same as batch race entry — N treasury outputs map to N creature state transitions. R4/R5/R6 register encoding is already the language the SC will speak. ErgoPay atomic pre-validation mirrors SC all-or-nothing validation.

---

## Fatigue/Sharpness Rework + Meditation + Treatment Center (2026-02-15)

### Overview
Five-phase rework of the creature condition system, adding strategic depth to training and recovery. All phases complete.

### Phase 1 — Sharpness Rework & Scaled Fatigue Decay
- **Per-activity sharpness deltas**: Each training activity now affects sharpness differently. Physical activities (Sprint Drills: −5, Distance Runs: −3, Cross-Training: −2) decrease sharpness, while mental activities (Gate Work: +5, Mental Prep: +15) increase it. Agility Course is neutral (±0).
- **Wider race sharpness modifier**: Range expanded from ×0.90–1.00 to **×0.80–×1.05**. At 0 sharpness, creatures suffer a 20% penalty; at 100, they get a 5% bonus. Computed by `computeSharpnessMod()` in `lib/training-engine.ts`.
- **Scaled fatigue decay tiers**: Fatigue no longer decays at a flat rate. Configurable tiers — light fatigue (<30) decays at ~3/day, moderate (30-60) at ~8/day, heavy (60-80) at ~12/day, severe (80+) at ~15/day. Implemented in `applyConditionDecay()`.
- **Faster sharpness decay**: 12-hour grace period after last action, then −15/day (previously −10/day). Keeps sharpness relevant as a "train recently before a race" mechanic.
- **Config-driven**: All values stored in `game_config` JSON — `sharpness_mod_floor`, `sharpness_mod_ceiling`, `sharpness_grace_hours`, `sharpness_decay_per_day`, `fatigue_decay_tiers`, per-activity `sharpness_delta`.
- **Frontend**: ActivityCard shows sharpness arrows (↑/↓/−), ConfirmModal has sharpness section, ResultModal shows sharpness change.

Migration: `013_sharpness_rework.sql`

### Phase 2 — Meditation (Recovery Training Action)
- **New activity**: Meditation — uses 1 training action, produces 0 stat gains, −25 fatigue, +15 sharpness.
- **Fatigue floor clamp**: `execute-action.ts` clamps fatigue to ≥0 after applying negative fatigue cost.
- **Recovery UI mode**: ActivityCard, ConfirmModal, and ResultModal detect recovery activities (fatigue_cost < 0) and show condition-focused UI instead of stat boosts. Stat boost selection hidden for recovery activities.
- **CHECK constraint update**: `training_log` has a CHECK constraint on `activity` column — migration adds `'meditation'` to the allowed values.

Migration: `014_meditation_activity.sql`

### Phase 3 — Treatment Center (Backend)
- **Three treatment tiers**:
  - **Stim Pack** — 6h lockout, −20 fatigue, sharpness unchanged, 0.005 ERG
  - **Cryo Pod** — 12h lockout, −40 fatigue, sharpness set to 50, 0.01 ERG
  - **Full Reset** — 24h lockout, fatigue to 0, sharpness set to 30, 0.02 ERG
- **Lockout model**: `creature_stats` gets `treatment_type`, `treatment_started_at`, `treatment_ends_at` columns. Creature cannot train or race while in treatment.
- **Lazy completion**: `checkAndCompleteTreatment()` in `execute-treatment.ts` — when `treatment_ends_at < now`, applies treatment effects (fatigue/sharpness changes), clears treatment columns, logs to `treatment_log`.
- **`treatment_log` table**: Records completed treatments with creature_id, season_id, treatment_type, duration_hours, fatigue/sharpness before/after.
- **Treatment config**: Stored in `game_config.treatments` JSON — per-collection overridable via deep merge.
- **ErgoPay support**: `treatment_fee` action type added to `ergopay/tx/request.ts` (validates creature not already in treatment, checks treatment type exists in config).
- **Credit ledger**: `treatment_fee` added to `LedgerTxType` union and DB CHECK constraint.

Migration: `015_treatment_center.sql`

Files: `api/_lib/execute-treatment.ts`, `api/v2/treatment/start.ts`, `api/v2/ergopay/tx/request.ts`

### Phase 4 — Treatment Center (Frontend)
- **Treatment.tsx page**: Full treatment center with two views:
  - *Creature selection*: Collection filter pills, creature grid with fatigue/sharpness bars, treatment timers for creatures already in treatment.
  - *Treatment detail*: Three tier cards (yellow/cyan/violet color themes) with lockout duration, effects preview, and cost. Confirm dialog, result dialog with treatment timer and ergexplorer TX link.
- **Fee flows**: Nautilus (sign_tx), ErgoPay (QR/deep-link via ErgoPayTxModal), and free-play (REQUIRE_FEES=false) all supported.
- **CreatureCard updates**: Shows TreatmentTimer (instead of CooldownTimer) when in treatment. Train/Race buttons disabled during treatment. "Treat" button links to `/treatment/:id`.
- **TreatmentTimer component**: Live countdown with progress bar. Compact mode for inline display, full mode for detail view.
- **Navigation**: "Treat" nav item with Stethoscope icon added to desktop sidebar and mobile bottom nav (7-column grid).
- **Routing**: `/treatment` and `/treatment/:creatureId` routes, lazy-loaded.

Files: `src/pages/Treatment.tsx`, `src/components/creatures/TreatmentTimer.tsx`, `src/components/creatures/CreatureCard.tsx`, `src/components/layout/Navigation.tsx`, `src/App.tsx`, `src/api/useTreatment.ts`

### Phase 5 — FAQ Updates
- **Training section**: Per-activity sharpness deltas displayed in grid, meditation callout with border accent.
- **Fatigue/Sharpness section**: Scaled decay explanation, wider modifier range (×0.80 to ×1.05), 12h grace period, recovery options summary.
- **Scoring section**: Updated sharpness modifier range and explanation of strategic impact.
- **Treatment Center section**: New accordion with color-coded tier cards (yellow/cyan/violet), strategic cost callout, lazy completion explanation.

File: `src/pages/FAQ.tsx`

### Key Pitfalls
- `training_log` has a CHECK constraint on `activity` column — must be ALTERed when adding new activities (migration 014).
- `credit_ledger` has a CHECK constraint on `tx_type` (migration 007) — must be ALTERed when adding new tx types like `treatment_fee` (migration 015).
- `recordLedgerEntry()` is fire-and-forget — CHECK constraint violations are silently swallowed, making missing ledger entries hard to debug.
- ErgoPay `tx/request.ts` if/else branching must use `else if` for each action type (not bare `else`) when there are 3+ action types.

---

## Production Hardening — Explorer Resilience & Whale Wallets (2026-02-15)

### Explorer API Resilience
NFT ownership verification (`verifyNFTOwnership`) previously treated Explorer API failures as "confirmed not owner" — rejecting valid users and wiping their `owner_address` from the DB. Now distinguishes between API unavailability and confirmed non-ownership:
- **API unavailable + DB says owner** → trusts the DB, action proceeds (warning logged)
- **API unavailable + DB says NOT owner** → returns 503 "try again" (doesn't grant false access)
- **API available + not owner** → existing 403 behavior unchanged

Files: `lib/ergo/types.ts` (added `apiUnavailable` flag to `NFTOwnershipResult`), `lib/ergo/server.ts` (sets flag in catch block), `api/_lib/execute-action.ts` (branching logic).

### Whale Wallet TX Support (MAX_TOKENS_PER_BOX)
Wallets with 100+ different token types failed on Nautilus TX building because all change tokens were packed into a single box, exceeding Ergo's `ErgoBox::MAX_TOKENS_COUNT` (255) limit. Additionally, token-heavy boxes require more than the base `MIN_NERG_BOX_VALUE` (1M nanoERG) due to Ergo's `minValuePerByte * boxSize` rule.

**Fix:** Change tokens are now split across multiple boxes (100 tokens per box, safety margin below protocol max). Each overflow box gets a dynamically calculated minimum ERG value based on its token count (~120 base bytes + 36 bytes/token, at 360 nanoERG/byte, with 20% margin).

**ErgoPay is not affected** — the `ergopay.duckdns.org` service builds change boxes server-side and handles token splitting internally.

Files: `src/lib/ergo/transactions.ts` (`MAX_TOKENS_PER_BOX`, `minBoxValue()`, multi-box change output loop).

### Improved Error Visibility
Training error catch block was swallowing non-Error exceptions (e.g. Nautilus wallet rejections returning objects instead of Error instances), showing only generic "Training failed". Now logs the full error to console (`[Train] Training error:`) and extracts messages from strings, objects, and Error instances.

File: `src/pages/Train.tsx` (catch block).

### Documentation
- `docs/GUIDE-nautilus-tx.md` — Updated Step 5 (change boxes), complete example, comparison table, and gotchas for whale wallet splitting + dynamic min box value
- `docs/GUIDE-ergopay-tx.md` — Added gotcha noting ErgoPay service handles whale wallets automatically

---

## Gamified Investment Display (2026-02-12)

### Overview
Three display surfaces show spending framed as investment: dashboard header, creature profile card, and a dedicated wallet ledger page. Uses the credit ledger data to show "you've burned X ERG fueling your pets, here's the pool you're competing for."

### Dashboard — Investment Summary
`src/components/dashboard/InvestmentSummary.tsx` — Compact card between page header and creature grid:
- Left: total ERG burned + session/race counts
- Right: season prize pool
- Links to `/wallet` for full details
- Only renders when wallet connected and has ledger activity

### Creature Profile — Investment Card
`src/components/creatures/CreatureInvestment.tsx` — Per-creature card between stats overview and race history:
- Training vs race entry spending breakdown
- W-P-S record from `creature.prestige`
- Filters ledger entries by `creatureId` client-side

### Wallet Ledger Page (`/wallet`)
`src/pages/WalletLedger.tsx` — Full transaction history:
- Summary cards: ERG Burned, Prize Pool, Activity (training + races count)
- Scrollable transaction list with date, memo, color-coded amounts (red debits, green credits)
- Accessible from "Ledger" link in sidebar/bottom nav

### Enhanced Wallet Ledger Endpoint
`api/v2/wallet/[address]/ledger.ts` — Added season context:
- `seasonPrizePoolErg` from active season's `prize_pool_nanoerg`
- `trainingCount` and `racesEntered` counts
- `creatureSpending[]` — per-creature spending breakdown (grouped debits by `creature_id`)

### Files Changed
- `api/v2/wallet/[address]/ledger.ts` — Enhanced with season context + per-creature breakdown
- `src/components/dashboard/InvestmentSummary.tsx` — **NEW**: Dashboard summary card
- `src/components/creatures/CreatureInvestment.tsx` — **NEW**: Creature profile investment card
- `src/pages/WalletLedger.tsx` — **NEW**: Full wallet ledger page
- `src/pages/Dashboard.tsx` — Added `<InvestmentSummary />` above creature grid
- `src/pages/CreatureProfile.tsx` — Added `<CreatureInvestment />` between stats and race history
- `src/App.tsx` — Added `/wallet` route
- `src/components/layout/Navigation.tsx` — Added "Ledger" nav link (Wallet icon), mobile nav `grid-cols-6`
- `src/types/game.ts` — Added `LedgerEntry`, `WalletLedger`, `CreatureSpending` types
- `src/api/index.ts` — Exported `useWalletLedger`

### Phase 2 Reusability
**100% reusable:** All frontend components, hooks, API endpoint, types, and `credit_ledger` table schema carry forward unchanged. Only change: chain scanner populates `credit_ledger` with `shadow=false` + `ergo_tx_id` instead of API `recordLedgerEntry()` calls. Frontend reads the same ledger API regardless of data source.

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

ErgoPay users can browse, train, and enter races. Paid transactions use the ErgoPay TX payment flow (`ErgoPayTxModal` with QR code + polling → backend executes action on payment confirmation). Both Nautilus and ErgoPay payment paths are built.

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
FAQ was inaccessible on mobile — the bottom nav only rendered the 4 primary `navItems`. Fixed by spreading `[...navItems, ...secondaryItems]` in the mobile render path, giving all 6 items (4 primary + Ledger + FAQ) equal space via `grid grid-cols-6`.

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
- `src/components/layout/Navigation.tsx` — FAQ + Ledger in mobile nav, `grid-cols-6` layout, overflow-hidden on items
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
