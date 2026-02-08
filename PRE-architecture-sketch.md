# NFT Racing: Architecture Sketch
## Phase 1 (DB) → Phase 2 (SC/AVL)

---

## Phase 1: Supabase DB + API (Build & Test)

> Goal: Validate game mechanics, tune balance, gather player feedback. 
> All game logic runs server-side. Wallet signatures for auth. No on-chain state yet.

---

### Database Schema

#### `collections` — Registered NFT collections
```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | uuid PK   | Collection ID                                  |
| name                | text      | e.g., "CyberPets"                              |
| policy_id           | text      | NFT collection token ID prefix                 |
| base_stat_template  | jsonb     | Default base stats by rarity/type              |
| trait_mapping       | jsonb     | How NFT metadata maps to stat affinities       |
| entry_fee           | bigint    | Race entry fee in nanoERG (50000000 = 0.05)    |
| training_fee        | bigint    | Training fee in nanoERG (10000000 = 0.01)      |
| created_at          | timestamptz |                                                |
```

**Example `base_stat_template`:**
```json
{
  "Common":    { "total_base": 25, "bias": { "speed": 0, "stamina": 0, "accel": 0, "agility": 0, "heart": 0, "focus": 0 } },
  "Uncommon":  { "total_base": 30, "bias": { "speed": 2, "stamina": 2, "accel": 1, "agility": 1, "heart": 2, "focus": 2 } },
  "Rare":      { "total_base": 35, "bias": { "speed": 3, "stamina": 3, "accel": 2, "agility": 2, "heart": 3, "focus": 2 } },
  "Epic":      { "total_base": 40, "bias": { "speed": 4, "stamina": 4, "accel": 3, "agility": 3, "heart": 3, "focus": 3 } },
  "Cyberium":  { "total_base": 45, "bias": { "speed": 5, "stamina": 5, "accel": 3, "agility": 4, "heart": 4, "focus": 4 } }
}
```

---

#### `creatures` — Individual NFTs registered for racing
```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | uuid PK   | Internal creature ID                           |
| collection_id       | uuid FK   | → collections.id                               |
| token_id            | text      | On-chain NFT token ID (unique)                 |
| owner_address       | text      | Current wallet address                         |
| rarity              | text      | Rarity tier from NFT metadata                  |
| metadata            | jsonb     | Raw NFT metadata (traits, body parts, etc.)    |
| base_stats          | jsonb     | Computed base stats from template + trait mapping |
| created_at          | timestamptz |                                                |
```

**Example `base_stats`:**
```json
{ "speed": 8, "stamina": 10, "accel": 5, "agility": 7, "heart": 6, "focus": 9 }
```

---

#### `seasons` — Monthly prestige cycles
```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | uuid PK   | Season ID                                      |
| collection_id       | uuid FK   | → collections.id                               |
| season_number       | int       | Sequential (1, 2, 3...)                        |
| start_date          | timestamptz | Season start                                 |
| end_date            | timestamptz | Season end                                   |
| modifier            | jsonb     | Seasonal theme/rule changes                    |
| prize_pool_nanoerg  | bigint    | Accumulated prize pool                         |
| status              | text      | 'active' | 'completed' | 'paying_out'         |
| payout_tx           | text      | TX ID of prize distribution (null until paid)  |
```

**Example `modifier`:**
```json
{ "theme": "Sprint Season", "race_type_weights": { "sprint": 2.0, "distance": 0.5, "technical": 1.0 } }
```

---

#### `creature_stats` — Current trained stats (resets each season)
```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | uuid PK   |                                                |
| creature_id         | uuid FK   | → creatures.id                                 |
| season_id           | uuid FK   | → seasons.id                                   |
| speed               | int       | Trained stat (0–80)                            |
| stamina             | int       | Trained stat (0–80)                            |
| accel               | int       | Trained stat (0–80)                            |
| agility             | int       | Trained stat (0–80)                            |
| heart               | int       | Trained stat (0–80)                            |
| focus               | int       | Trained stat (0–80)                            |
| fatigue             | int       | Condition meter (0–100)                        |
| sharpness           | int       | Condition meter (0–100)                        |
| action_count        | int       | Total actions this season                      |
| race_count          | int       | Total races this season                        |
| last_action_at      | timestamptz | For cooldown enforcement                     |
| last_race_at        | timestamptz | For 1-race-per-day enforcement               |
| updated_at          | timestamptz |                                                |
```

**Unique constraint:** `(creature_id, season_id)` — one stat row per creature per season.

---

#### `training_log` — Every training action (audit trail)
```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | uuid PK   |                                                |
| creature_id         | uuid FK   | → creatures.id                                 |
| season_id           | uuid FK   | → seasons.id                                   |
| activity            | text      | 'sprint_drills' | 'distance_runs' | 'agility_course' | 'gate_work' | 'cross_training' | 'mental_prep' |
| stat_changes        | jsonb     | { "speed": +6.2, "accel": +2.1 } (after diminishing returns) |
| fatigue_change      | int       | +12, +8, etc.                                  |
| sharpness_change    | int       | +20, etc.                                      |
| fee_nanoerg         | bigint    | 10000000 (0.01 ERG)                            |
| tx_id               | text      | Payment TX ID (null in DB-only phase)          |
| created_at          | timestamptz |                                                |
```

---

#### `races` — Race events
```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | uuid PK   |                                                |
| collection_id       | uuid FK   | → collections.id                               |
| season_id           | uuid FK   | → seasons.id                                   |
| race_type           | text      | 'sprint' | 'distance' | 'technical' | 'mixed' | 'hazard' |
| entry_fee_nanoerg   | bigint    | 50000000 (0.05 ERG)                            |
| max_entries         | int       | e.g., 8                                        |
| status              | text      | 'open' | 'locked' | 'resolved' | 'paid'        |
| rng_seed            | text      | Block hash or oracle data used for RNG         |
| results             | jsonb     | Ordered finish positions + performance scores  |
| created_at          | timestamptz |                                                |
| resolved_at         | timestamptz |                                                |
```

---

#### `race_entries` — Creatures entered in races
```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | uuid PK   |                                                |
| race_id             | uuid FK   | → races.id                                     |
| creature_id         | uuid FK   | → creatures.id                                 |
| owner_address       | text      | Wallet that entered                            |
| snapshot_stats      | jsonb     | Stats at time of entry (frozen for race calc)  |
| snapshot_fatigue    | int       | Fatigue at entry                               |
| snapshot_sharpness  | int       | Sharpness at entry                             |
| performance_score   | numeric   | Calculated race performance                    |
| finish_position     | int       | 1st, 2nd, 3rd, etc.                           |
| fee_nanoerg         | bigint    | Entry fee paid                                 |
| tx_id               | text      | Payment TX ID (null in DB-only phase)          |
| created_at          | timestamptz |                                                |
```

---

#### `leaderboard` — Season standings (materialized / updated after each race)
```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | uuid PK   |                                                |
| creature_id         | uuid FK   | → creatures.id                                 |
| season_id           | uuid FK   | → seasons.id                                   |
| owner_address       | text      |                                                |
| wins                | int       | 1st place finishes                             |
| places              | int       | Top-3 finishes                                 |
| shows               | int       | Top-half finishes                              |
| races_entered       | int       |                                                |
| total_earnings      | bigint    | nanoERG earned this season                     |
| updated_at          | timestamptz |                                                |
```

---

#### `payouts` — Prize distributions
```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | uuid PK   |                                                |
| season_id           | uuid FK   | → seasons.id                                   |
| owner_address       | text      | Recipient wallet                               |
| pool_type           | text      | 'win' | 'place' | 'show'                      |
| amount_nanoerg      | bigint    | Payout amount                                  |
| tx_id               | text      | Payout TX ID                                   |
| created_at          | timestamptz |                                                |
```

---

#### `prestige` — Permanent records across seasons
```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | uuid PK   |                                                |
| creature_id         | uuid FK   | → creatures.id                                 |
| total_seasons       | int       | Prestige tier (# completed seasons)            |
| lifetime_wins       | int       |                                                |
| lifetime_places     | int       |                                                |
| lifetime_shows      | int       |                                                |
| lifetime_races      | int       |                                                |
| lifetime_earnings   | bigint    | Total nanoERG earned all-time                  |
| badges              | jsonb     | ["sprint_champion_s1", "iron_horse_s3", ...]   |
| updated_at          | timestamptz |                                                |
```

---

### Game Config (constants, easily tunable)

```json
{
  "stats": {
    "budget_cap": 300,
    "per_stat_cap": 80,
    "diminishing_formula": "base_gain * (1 - current / cap)"
  },
  "activities": {
    "sprint_drills":   { "primary": "speed",   "primary_gain": 8, "secondary": "accel",   "secondary_gain": 3, "fatigue": 12 },
    "distance_runs":   { "primary": "stamina", "primary_gain": 8, "secondary": "heart",   "secondary_gain": 3, "fatigue": 12 },
    "agility_course":  { "primary": "agility", "primary_gain": 8, "secondary": "focus",   "secondary_gain": 3, "fatigue": 8  },
    "gate_work":       { "primary": "accel",   "primary_gain": 6, "secondary": "focus",   "secondary_gain": 4, "fatigue": 6  },
    "cross_training":  { "primary": "speed",   "primary_gain": 5, "secondary": "stamina", "secondary_gain": 5, "fatigue": 15 },
    "mental_prep":     { "primary": "heart",   "primary_gain": 5, "secondary": "focus",   "secondary_gain": 5, "fatigue": 3  }
  },
  "cooldowns": {
    "training_hours": 12,
    "race_per_day": 1
  },
  "condition": {
    "fatigue_natural_decay_per_day": 3,
    "sharpness_gain_on_train": 20,
    "sharpness_decay_per_idle_day": 10,
    "fatigue_penalty_formula": "1.0 - (fatigue / 200)",
    "sharpness_bonus_formula": "0.90 + (sharpness / 1000)"
  },
  "race_types": {
    "sprint":    { "speed": 3.0, "stamina": 0.5, "accel": 3.0, "agility": 1.0, "heart": 0.5, "focus": 1.5 },
    "distance":  { "speed": 1.5, "stamina": 3.0, "accel": 0.5, "agility": 1.0, "heart": 3.0, "focus": 1.5 },
    "technical": { "speed": 1.0, "stamina": 1.5, "accel": 0.5, "agility": 3.0, "heart": 1.0, "focus": 3.0 },
    "mixed":     { "speed": 2.0, "stamina": 2.0, "accel": 1.5, "agility": 1.5, "heart": 1.5, "focus": 1.0 },
    "hazard":    { "speed": 1.0, "stamina": 1.0, "accel": 1.0, "agility": 2.5, "heart": 1.5, "focus": 3.0 }
  },
  "focus_rng": {
    "formula": "rng_swing = 0.30 * (1 - focus / max_focus)",
    "max_swing_at_0_focus": 0.30,
    "min_swing_at_80_focus": 0.03
  },
  "prize_distribution": {
    "win_pool": 0.40,
    "place_pool": 0.35,
    "show_pool": 0.25
  }
}
```

---

### API Endpoints (Phase 1)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/collections/:id/register` | POST | Register an NFT for racing (verify ownership via wallet sig) |
| `/api/creatures/:id/train` | POST | Submit training action (body: `{ activity }`) |
| `/api/creatures/:id/stats` | GET | Current stats, fatigue, sharpness, cooldown status |
| `/api/races` | GET | Available races (open for entry) |
| `/api/races/:id/enter` | POST | Enter creature in race |
| `/api/races/:id/resolve` | POST | Trigger race resolution (admin or cron after entries close) |
| `/api/races/:id/results` | GET | Race results + performance breakdown |
| `/api/leaderboard/:season_id` | GET | Current season standings |
| `/api/creatures/:id/history` | GET | Training log + race history |
| `/api/seasons/current` | GET | Active season info + modifier |

### Auth Flow (Phase 1)
```
1. User connects Nautilus wallet
2. Frontend requests signature of a challenge message
3. Backend verifies signature → derives wallet address
4. All actions authenticated by wallet signature (no passwords/accounts)
```

### Race Resolution Flow (Phase 1)
```
1. Race reaches max entries (or time limit)  
2. Status → 'locked'  
3. Server fetches latest block hash as RNG seed  
4. For each entrant:  
   a. Read snapshot_stats + fatigue + sharpness  
   b. Apply race_type weights → weighted_score  
   c. Apply fatigue_penalty × sharpness_bonus  
   d. Generate RNG modifier: hash(block_hash + creature_id) → [-swing, +swing]  
      where swing = 0.30 × (1 - focus/80)  
   e. final_score = weighted_score × fatigue_mod × sharpness_mod × (1 + rng_modifier)  
5. Rank by final_score → assign finish positions  
6. Store results, update leaderboard  
7. Status → 'resolved'  
```

---

## Phase 2: On-Chain SC + AVL Tree (Production)

> Goal: Move proven game logic on-chain. DB becomes read cache / indexer.
> All state lives in AVL tree. All logic in ErgoScript. Fully P2P.

---

### Architecture Comparison

| Component | Phase 1 (DB) | Phase 2 (SC/AVL) |
|-----------|-------------|-------------------|
| Stat storage | Supabase `creature_stats` table | AVL tree on-chain (digest in box register) |
| Training logic | API server function | ErgoScript contract validates stat changes |
| Race logic | API server function | ErgoScript contract computes results |
| Cooldown enforcement | `last_action_at` timestamp check | `HEIGHT >= lastActionHeight + 360` |
| Prize pool | DB ledger + manual payout TX | Accumulator box; SC distributes automatically |
| RNG | Server fetches block hash | SC reads `CONTEXT.headers` for block hash |
| Auth | Wallet signature verification | TX must be signed by NFT owner (native) |
| Fee collection | Server constructs TX, user signs | User builds TX with 0.01/0.05 ERG to pool box |

---

### AVL Tree Structure

**Single AVL tree per collection**, stored as a digest (32 bytes) in a state box register.

| Field | Key | Value Format |
|-------|-----|-------------|
| **Key** | NFT token ID (32 bytes) | — |
| **Value** | Packed byte array (fixed-length) | See below |

**Value encoding (26 bytes per creature):**

```
| Bytes | Field          | Type    | Range    |
|-------|----------------|---------|----------|
| 0-1   | speed          | Short   | 0–80     |
| 2-3   | stamina        | Short   | 0–80     |
| 4-5   | accel          | Short   | 0–80     |
| 6-7   | agility        | Short   | 0–80     |
| 8-9   | heart          | Short   | 0–80     |
| 10-11 | focus          | Short   | 0–80     |
| 12-13 | fatigue        | Short   | 0–100    |
| 14-15 | sharpness      | Short   | 0–100    |
| 16-19 | lastActionHeight | Int   | Block #  |
| 20-23 | lastRaceHeight | Int     | Block #  |
| 24-25 | actionCount    | Short   | 0–65535  |
```

**Why AVL vs per-creature boxes:**

| Approach | Pro | Con |
|----------|-----|-----|
| **AVL tree** (1 box holds all creatures) | Single state box to manage; race SC reads all entrants from one tree; no UTXO contention if batched | Requires off-chain service to build proofs; more complex TX construction |
| **Per-creature boxes** (1 box per NFT) | Simpler TX; no proof generation needed; fully parallel | Race SC must consume N boxes simultaneously; UTXO contention between training + racing; box proliferation |

**Recommendation: AVL tree** — especially since you already have AVL experience from oracle pool work. A single state box with the tree digest is cleaner for race resolution (one lookup per entrant, all from same tree).

---

### Smart Contract Architecture

#### Contract 1: Training Contract
```
Purpose: Validate training actions and update AVL tree
Inputs:  State box (AVL digest) + User TX with 0.01 ERG
Outputs: New state box (updated AVL digest) + 0.01 ERG to prize pool box

Validation logic:
  1. TX signer owns the NFT token ID being trained
  2. HEIGHT >= creature.lastActionHeight + 360  (12-hour cooldown)
  3. Activity is one of the 6 valid types
  4. Stat changes follow diminishing returns formula:
     - gain = base_gain × (1 - current_stat / 80)
     - total stats (all 6) do not exceed 300
  5. Fatigue change matches activity's defined cost
  6. Sharpness updated correctly
  7. lastActionHeight set to current HEIGHT
  8. actionCount incremented
  9. 0.01 ERG sent to prize pool box
  10. AVL tree proof verifies correct insertion
```

#### Contract 2: Race Entry Contract
```
Purpose: Register creature for a race, snapshot stats
Inputs:  Race box + State box (AVL read) + User TX with 0.05 ERG
Outputs: Updated race box (new entrant added) + 0.05 ERG to prize pool

Validation logic:
  1. TX signer owns the NFT token ID
  2. HEIGHT >= creature.lastRaceHeight + 720  (24-hour cooldown, ~1/day)
  3. Race is in 'open' status and not full
  4. Creature not already entered in this race
  5. Stats snapshot recorded in race box registers
  6. 0.05 ERG sent to prize pool box
```

#### Contract 3: Race Resolution Contract
```
Purpose: Compute results deterministically, distribute payouts
Inputs:  Race box (with all entrant snapshots) + Prize pool box
Outputs: Payout boxes to winners + updated prize pool box + updated state box

Validation logic:
  1. Race has required number of entrants (or time limit reached)
  2. RNG seed = blake2b256(race_box_id ++ CONTEXT.headers(0).id)
  3. For each entrant, compute:
     weighted_score = sum(stat × race_type_weight)
     fatigue_mod = 1.0 - (fatigue / 200)
     sharpness_mod = 0.90 + (sharpness / 1000)
     creature_rng = hash(rng_seed ++ token_id) mod 1000 → [-swing, +swing]
       where swing = 300 × (1 - focus / 80) → mapped to ±0.03 to ±0.30
     final_score = weighted_score × fatigue_mod × sharpness_mod × (1 + creature_rng/1000)
  4. Rank entrants by final_score
  5. Distribute race entry fees: 50% to 1st, 30% to 2nd, 20% to 3rd
     (Remaining training fees accumulate for end-of-season payout)
  6. Update lastRaceHeight for each entrant in AVL tree
  7. Update leaderboard tallies in AVL tree (or separate tree)
```

#### Contract 4: Season Payout Contract
```
Purpose: Distribute accumulated prize pool at end of season
Inputs:  Prize pool box + Leaderboard data (AVL tree)
Outputs: Payout boxes to top performers

Validation logic:
  1. Current HEIGHT >= season_end_height
  2. Leaderboard rankings verified from AVL tree
  3. Win pool (40%) distributed to top winners
  4. Place pool (35%) distributed to top place finishers  
  5. Show pool (25%) distributed to top show finishers
  6. All creature stats in AVL tree reset to 0 for new season
```

---

### Off-Chain Components (Phase 2)

Even with full SC logic, you still need lightweight off-chain services:

| Service | Purpose | Complexity |
|---------|---------|-----------|
| **TX Builder** | Constructs training/race TXs with AVL proofs for user to sign in Nautilus | Medium — needs to query current AVL state, build proofs |
| **Indexer** | Watches chain for training/race TXs, maintains readable DB mirror | Medium — standard Ergo scanner pattern |
| **Frontend** | React app showing stats, available races, leaderboard | Already partially built |
| **Race Scheduler** | Creates race boxes on a schedule (daily, or on-demand) | Simple cron or manual |

---

### Migration Path: Phase 1 → Phase 2

| Step | Action | When |
|------|--------|------|
| 1 | Launch Phase 1 with DB + API | Now |
| 2 | Playtest with CyberPets community | 2–4 weeks |
| 3 | Tune balance constants based on data | Ongoing |
| 4 | Finalize stat gains, fatigue curves, race formulas | After ~100 races |
| 5 | Encode finalized constants into ErgoScript contracts | After balance is stable |
| 6 | Deploy contracts to testnet | 1–2 weeks of testing |
| 7 | Migrate to mainnet; DB becomes read-only indexer | Production launch |
| 8 | Open-source frontend + TX builder | Post-launch (legal defense) |

---

### What the DB Becomes in Phase 2

| Phase 1 Role | Phase 2 Role |
|-------------|-------------|
| Source of truth for stats | **Read cache** — indexed from on-chain AVL tree |
| Enforces cooldowns | SC enforces via HEIGHT |
| Computes race results | SC computes deterministically |
| Collects fees | SC collects into pool box |
| Stores training log | **Audit trail** — indexed from on-chain TXs |
| Serves API to frontend | Still serves API, but reads from chain-synced DB |

The DB never goes away — it just shifts from "game engine" to "indexer + API layer." The frontend talks to the DB for fast reads; the DB syncs from the chain for truth.
