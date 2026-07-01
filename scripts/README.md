# scripts/

This folder contains the three core Node.js (ESM) scripts that power the entire GitOps pipeline.

All scripts are intentionally dependency-light so they run reliably in GitHub Actions' `ubuntu-latest` environment.

## Script Overview

| Script                  | Purpose                                      | When to Run                  | Typical Duration (125k) | Produces / Updates                  |
|-------------------------|----------------------------------------------|------------------------------|-------------------------|-------------------------------------|
| `hydrate.js`            | One-time bulk download of entire collection  | Only on first setup or major backfill | 10–40 min              | `schemas/gkniftyheads.json`, `templates.json`, `manifest.json` |
| `delta-sync.js`         | Daily incremental update (new mints + burns) | Every night (via workflow)   | < 1 min                | Updates schema files + manifest     |
| `calculate-rarity.js`   | Weighted rarity, surviving mint ranks, trait exposure, leaderboards | After hydrate or delta-sync | 30–90 seconds          | `template_stats.json`, `trait_exposure.json`, `leaderboard.json` |

## 1. hydrate.js — Initial Collection Download

**What it does**
- Uses cursor-based pagination (`lower_bound` on `asset_id`) — the correct and most efficient way to fetch large WAX collections.
- Fetches in batches of 500 (adjustable).
- Extracts and normalizes key fields: `asset_id`, `template_id`, `template_mint`, `owner`, `burned`, `attributes`, etc.
- Saves everything into `data/schemas/gkniftyheads.json` (and `templates.json`).
- Updates `manifest.json` with totals and timestamp.

**Important safety note**
- Contains a demo limit (`if (totalFetched > 2000)`) so the first test run finishes quickly.
- **Remove or comment out this limit before running the real 125k+ hydration.**

**How to run**
```bash
node scripts/hydrate.js
```

**Configuration** (edit at top of file)
- `BATCH_SIZE` — 200–500 is safe. Lower = more API calls but gentler on rate limits.
- `COLLECTION` — currently hardcoded to `gkniftyheads`. Easy to make configurable.
- Sleep delay between requests for politeness.

**Best practice**
Run this once locally on a machine with good internet. It only needs to be re-run if you ever want a full historical reset.

---

## 2. delta-sync.js — Daily Delta Updates

**Current status in v0.2**
This script is still a **skeleton/placeholder** with clear comments describing exactly what needs to be implemented.

**What it should do (and what the comments instruct)**
1. Read `last_sync_timestamp` from `manifest.json`.
2. Fetch **new mints** since that timestamp:
   ```
   GET /atomicassets/v1/assets?collection_name=gkniftyheads&after=TIMESTAMP&sort=created&order=asc&limit=100
   ```
3. Fetch **recent burns**:
   ```
   GET /atomicassets/v1/assets?collection_name=gkniftyheads&burned=true&after=TIMESTAMP&sort=updated&order=asc&limit=100
   ```
4. Merge new/updated assets into the existing `schemas/gkniftyheads.json` file.
5. Update `manifest.json` with the new timestamp and counts.
6. (Optional) Re-run `calculate-rarity.js` automatically at the end.

**Why it's a placeholder right now**
The full merging + pagination loop logic was intentionally left for the dev team to implement cleanly (it’s straightforward once you have the pattern from `hydrate.js`).

**How to finish it (5–10 minutes of work)**
Copy the pagination + fetch + sleep pattern from `hydrate.js`, adapt the query parameters as shown in the comments, and implement a simple `mergeAssets()` function that updates or appends records by `asset_id`.

Once implemented, the nightly workflow becomes fully autonomous.

---

## 3. calculate-rarity.js — The Brains (Weighted Rarity + Surviving Ranks)

This is the most important script for Waxman’s requirements.

**What it produces**
- `template_stats.json` — living supply, burn rate, min/max surviving mint per template
- `trait_exposure.json` — split into `rarity_traits` and `variation_traits` with live %
- `leaderboard.json` — holder leaderboard + rarity leaderboard (top 100) with all the fields Waxman asked for:
  - `original_template_mint`
  - `surviving_mint_rank`
  - `weighted_rarity_score`
  - `base_rarity_score` (for transparency)

**Key algorithm details**
- Only processes **active** assets (`!burned && owner`)
- Groups by `template_id`
- Sorts each template’s survivors by `template_mint` → assigns `surviving_mint_rank`
- Applies the weighted formula described in the root README

**How to run**
```bash
node scripts/calculate-rarity.js
```

It can be run standalone after any data change.

**Tuning the weights**
All magic numbers and multipliers are in one clearly commented section near the top/middle of the file. Change them, save, re-run — done.
