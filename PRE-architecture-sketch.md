# Phase 2: On-Chain Smart Contracts (Design Notes)

> These are pre-development design notes for the eventual on-chain migration.
> Phase 1 (current) runs on Supabase + Vercel. See `STATUS.md` for current state.

---

## Architecture Comparison (Phase 1 → Phase 2)

| Component | Phase 1 (DB) | Phase 2 (SC/AVL) |
|-----------|-------------|-------------------|
| Stat storage | Supabase `creature_stats` table | AVL tree on-chain (digest in box register) |
| Training logic | API server function | ErgoScript contract validates stat changes |
| Race logic | API server function | ErgoScript contract computes results |
| Cooldown enforcement | `last_action_at` timestamp check | `HEIGHT >= lastActionHeight + 360` |
| Prize pool | DB ledger + manual payout TX | Accumulator box; SC distributes automatically |
| RNG | Server fetches block hash | SC reads `CONTEXT.headers` for block hash |
| Auth | On-chain NFT ownership via Explorer API | TX must be signed by NFT owner (native) |
| Fee collection | Server constructs TX, user signs | User builds TX with 0.01/0.05 ERG to pool box |

---

## AVL Tree Structure

**Single AVL tree per collection**, stored as a digest (32 bytes) in a state box register.

| Field | Key | Value Format |
|-------|-----|-------------|
| **Key** | NFT token ID (32 bytes) | — |
| **Value** | Packed byte array (fixed-length) | See below |

**Value encoding (26 bytes per creature):**

```
| Bytes | Field          | Type    | Range    |
|-------|----------------|---------|----------|
| 0-1   | speed          | Short   | 0-80     |
| 2-3   | stamina        | Short   | 0-80     |
| 4-5   | accel          | Short   | 0-80     |
| 6-7   | agility        | Short   | 0-80     |
| 8-9   | heart          | Short   | 0-80     |
| 10-11 | focus          | Short   | 0-80     |
| 12-13 | fatigue        | Short   | 0-100    |
| 14-15 | sharpness      | Short   | 0-100    |
| 16-19 | lastActionHeight | Int   | Block #  |
| 20-23 | lastRaceHeight | Int     | Block #  |
| 24-25 | actionCount    | Short   | 0-65535  |
```

**Why AVL vs per-creature boxes:**

| Approach | Pro | Con |
|----------|-----|-----|
| **AVL tree** (1 box holds all creatures) | Single state box to manage; race SC reads all entrants from one tree; no UTXO contention if batched | Requires off-chain service to build proofs; more complex TX construction |
| **Per-creature boxes** (1 box per NFT) | Simpler TX; no proof generation needed; fully parallel | Race SC must consume N boxes simultaneously; UTXO contention between training + racing; box proliferation |

**Recommendation: AVL tree** — single state box with the tree digest is cleaner for race resolution (one lookup per entrant, all from same tree).

---

## Smart Contract Architecture

### Contract 1: Training Contract
```
Purpose: Validate training actions and update AVL tree
Inputs:  State box (AVL digest) + User TX with 0.01 ERG
Outputs: New state box (updated AVL digest) + 0.01 ERG to prize pool box

Validation logic:
  1. TX signer owns the NFT token ID being trained
  2. HEIGHT >= creature.lastActionHeight + 360  (12-hour cooldown)
  3. Activity is one of the 6 valid types
  4. Stat changes follow diminishing returns formula:
     - gain = base_gain x (1 - current_stat / 80)
     - total stats (all 6) do not exceed 300
  5. Fatigue change matches activity's defined cost
  6. Sharpness updated correctly
  7. lastActionHeight set to current HEIGHT
  8. actionCount incremented
  9. 0.01 ERG sent to prize pool box
  10. AVL tree proof verifies correct insertion
```

### Contract 2: Race Entry Contract
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

### Contract 3: Race Resolution Contract
```
Purpose: Compute results deterministically, distribute payouts
Inputs:  Race box (with all entrant snapshots) + Prize pool box
Outputs: Payout boxes to winners + updated prize pool box + updated state box

Validation logic:
  1. Race has required number of entrants (or time limit reached)
  2. RNG seed = blake2b256(race_box_id ++ CONTEXT.headers(0).id)
  3. For each entrant, compute:
     weighted_score = sum(stat x race_type_weight)
     fatigue_mod = 1.0 - (fatigue / 200)
     sharpness_mod = 0.90 + (sharpness / 1000)
     creature_rng = hash(rng_seed ++ token_id) mod 1000 -> [-swing, +swing]
       where swing = 300 x (1 - focus / 80) -> mapped to +/-0.03 to +/-0.30
     final_score = weighted_score x fatigue_mod x sharpness_mod x (1 + creature_rng/1000)
  4. Rank entrants by final_score
  5. Distribute race entry fees: 50% to 1st, 30% to 2nd, 20% to 3rd
     (Remaining training fees accumulate for end-of-season payout)
  6. Update lastRaceHeight for each entrant in AVL tree
  7. Update leaderboard tallies in AVL tree (or separate tree)
```

### Contract 4: Season Payout Contract
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

## Off-Chain Components (still needed with full SC)

| Service | Purpose | Complexity |
|---------|---------|-----------|
| **TX Builder** | Constructs training/race TXs with AVL proofs for user to sign in Nautilus | Medium |
| **Indexer** | Watches chain for training/race TXs, maintains readable DB mirror | Medium |
| **Frontend** | React app showing stats, available races, leaderboard | Already built |
| **Race Scheduler** | Creates race boxes on a schedule (daily, or on-demand) | Simple cron or manual |
