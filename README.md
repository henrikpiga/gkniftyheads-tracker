# gkniftyheads-tracker

**GitOps Serverless Pipeline for GK Nifty Heads (gkniftyheads) on WAX**

A complete, free, zero-server-cost system to track the ~125k+ asset GK Nifty Heads collection (and future expansions up to 500k+). It delivers:

- **Live surviving supply** per template
- **Surviving mint rank** after burns (re-ranked within each template by original `template_mint`)
- **Weighted rarity scoring** (template supply weight + mint number bonuses + rarity name + variation trait multipliers)
- **Live trait exposure** (% of current survivors that carry each rarity trait vs variation trait)
- **Holder & rarity leaderboards** updated daily

Everything runs via **GitHub Actions** (free) → static JSON files → lightning-fast frontend via CDN (jsDelivr / GitHub Pages / Vercel). No database, no monthly bills, fully transparent and versioned.

> **Perfect for the WAXFAMs community & the GK Nifty Heads team.** Hand this repo + README to your AI/dev team and they can have a production-grade tracker running in hours.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Why This Architecture? (GitOps vs Alternatives)](#why-this-architecture-gitops-vs-alternatives)
3. [How It Solves Your Exact Requirements](#how-it-solves-your-exact-requirements)
4. [Architecture & Data Flow](#architecture--data-flow)
5. [Data Outputs Explained](#data-outputs-explained)
6. [Weighted Rarity + Surviving Mint Rank Algorithm](#weighted-rarity--surviving-mint-rank-algorithm)
7. [Scripts Documentation](#scripts-documentation)
8. [Automation with GitHub Actions](#automation-with-github-actions)
9. [Frontend / Demo](#frontend--demo)
10. [Customization Guide](#customization-guide)
11. [WAX AtomicAssets API Best Practices](#wax-atomicassets-api-best-practices)
12. [Scaling & Performance](#scaling--performance)
13. [Migration Path to Full Backend](#migration-path-to-full-backend)
14. [Troubleshooting](#troubleshooting)
15. [Contributing & Next Steps](#contributing--next-steps)

---

## Quick Start

```bash
git clone https://github.com/henrikpiga/gkniftyheads-tracker.git
cd gkniftyheads-tracker
npm install
```

### 1. One-time full hydration (first run only)
```bash
node scripts/hydrate.js          # Downloads ~125k assets via cursor pagination (remove demo limit first)
```

### 2. Calculate weighted rarity + ranks (run after hydration or daily)
```bash
node scripts/calculate-rarity.js
```

### 3. Preview the beautiful interactive demo
Open `demo/index.html` in any browser. It now dynamically loads the generated JSON files.

### 4. Enable daily automation
Go to **Actions** tab → enable the `daily-sync.yml` workflow. It will run every night, fetch only deltas (mints + burns), recalculate everything, and commit fresh data.

### 5. Deploy frontend (optional but recommended)
- Push to GitHub → enable GitHub Pages, or
- Deploy `demo/` (or a Next.js version) to **Vercel** / **Netlify** for free.

All data is served via free CDN (`https://cdn.jsdelivr.net/gh/henrikpiga/gkniftyheads-tracker@main/data/...`).

---

## Why This Architecture? (GitOps vs Alternatives)

| Approach                    | Cost     | Scalability (500k+) | Maintenance | Real-time? | Recommendation for gkniftyheads |
|-----------------------------|----------|---------------------|-------------|------------|---------------------------------|
| **GitOps Serverless (this repo)** | $0      | Excellent          | Very Low   | Daily     | **Strongly Recommended**       |
| Client-Side (baked into browser) | $0     | Poor (mobile lag)  | Low        | Near real | Only for < 50k assets          |
| Dedicated Backend (Postgres + cron) | $$–$$$ | Excellent          | High       | Sub-hourly| Only if you need user accounts / sub-hourly updates |

**Why GitOps wins here**:
- Data changes infrequently (daily mints/burns are manageable).
- GitHub Actions gives you free compute every day.
- Static JSON + CDN = instant loads, zero hosting cost.
- Everything is versioned, auditable, and open-source friendly for the community.

---

## How It Solves Your Exact Requirements

WAXFAMs / GK Nifty Heads stated needs:

| Requirement                        | How This System Delivers It                                                                 | Output File(s)                  |
|------------------------------------|---------------------------------------------------------------------------------------------|---------------------------------|
| Live surviving supply              | Counts only non-burned + owned assets per template every run                               | `template_stats.json`           |
| Live rarity trait exposure         | % of current survivors that have each rarity/tier/legendary trait                          | `trait_exposure.json` (rarity_traits) |
| Live variation trait exposure      | % of current survivors that have special/variation/unique traits                           | `trait_exposure.json` (variation_traits) |
| Original mint number               | Preserves `template_mint` from AtomicAssets                                                  | All leaderboards + asset objects |
| Surviving mint rank after burns    | Within each template, re-sorts survivors by original `template_mint` and assigns rank 1–N   | `rarity_leaderboard` + individual assets |
| Weighted rarity                    | Statistical base + template supply weight + mint # bonuses + Legendary/1/1 + variation multipliers | `weighted_rarity_score` field   |

All calculations run **only on surviving assets** (burned assets are excluded from rankings and trait exposure).

---

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                         │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   scripts/   │  │      data/       │  │     demo/        │   │
│  │ hydrate.js   │──│ templates.json   │  │ index.html       │   │
│  │ delta-sync.js│  │ schemas/*.json   │  │ (dynamic loader) │   │
│  │ calculate-   │  │ manifest.json    │  └──────────────────┘   │
│  │   rarity.js  │  │ template_stats   │                           │
│  │   rarity.js  │  │ trait_exposure   │                           │
│  └──────────────┘  │ leaderboard.json │                           │
│         │          └──────────────────┘                           │
│         ▼          └──────────────────┘                           │
│  .github/workflows/daily-sync.yml (runs nightly)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (free CDN)
                    ┌──────────────────────┐
                    │   Public Frontend    │
                    │  (Vercel / GitHub Pages / jsDelivr)
                    └──────────────────────┘
```

**Russian-doll layering** (as originally requested):
- Layer 1: Storage (flat JSON in `/data`)
- Layer 2: One-time Hydration
- Layer 3: Daily Delta Sync (mints + burns)
- Layer 4: Rarity Calculation Engine (weighted + surviving ranks)
- Layer 5: Frontend Presentation (static JSON powered)

---

## Complete Repository Structure & File-by-File Explanation

This section gives you (and any AI/dev team you hand this to) a crystal-clear map of **every folder and every file** in the repository, what it does, and why it exists. This is the educational heart of the project.

### Root Level
- `README.md` — The single source of truth. Full handbook with architecture, requirements mapping, formulas, WAX best practices (including onblock.dev recommendations), step-by-step, customization, migration path, and this structure guide. Anyone can read this top-to-bottom and understand the entire system.
- `package.json` — Node project metadata + convenient `npm run` shortcuts (e.g. `npm run calculate`).
- `config.json` — **Single place to tune everything** without touching code: collection name, batch sizes, rate limits, all rarity weights/multipliers, API endpoints + fallbacks, GZIP toggle, demo limit, max leaderboard size. This is the control panel for the whole pipeline.
- `.gitignore` — Keeps junk out of Git (node_modules, large generated files if you choose, editor files). Sample data is intentionally committed so the demo works instantly.
- `LICENSE` — MIT license — fully open for the WAXFAMs community to fork, improve, and share.

### `.github/` Folder
Contains GitHub-specific automation and configuration.
- `workflows/daily-sync.yml` — The heart of the zero-cost automation. Runs on schedule (or manually). Checks out code, runs delta-sync + calculate-rarity, commits fresh JSONs back to `main`. No secrets needed. This is what makes the "GitOps Serverless" model work.
- `README.md` — Explains how to enable the workflow, what it does, safety notes, and how to customize the cron schedule.

### `data/` Folder (The Single Source of Truth)
All pre-computed, versioned, CDN-serveable JSON files. Never edit these manually — they are generated by the scripts.
- `README.md` — Detailed guide to every file, the static + CDN philosophy, GZIP recommendations, schema splitting for scale, caching best practices, and "do not edit manually" rules.
- `manifest.json` — Global state: last_sync_timestamp, total minted, active supply, etc. The "clock" of the system.
- `templates.json` — Master lookup table for every template_id → max_supply + immutable traits. Small and fast to load.
- `schemas/gkniftyheads.json` — The main asset records (one file per schema/collection for manageability at 125k–500k scale). Contains asset_id, template_id, template_mint, owner, burned, attributes, etc.
- `template_stats.json` — Live per-template stats: surviving_count, burn_rate_%, lowest/highest surviving mint, avg weighted rarity. Powers the "Template Stats" cards in the demo.
- `trait_exposure.json` — Live % of current survivors that carry each trait, cleanly split into `rarity_traits` and `variation_traits`. Powers the percentage bars.
- `leaderboard.json` — The two leaderboards: holder_leaderboard (top wallets by total weighted rarity) + rarity_leaderboard (top 100 rarest assets with surviving_mint_rank, weighted_rarity_score, original_template_mint, etc.).
- `*.json.gz` (optional) — Gzipped versions written when `gzipOutputs: true` in config.json. Great for advanced CDN setups.

### `scripts/` Folder (The Brains)
Three focused Node.js (ESM) scripts with almost zero dependencies.
- `README.md` — Full educational documentation for each script, current status, exact implementation steps for delta-sync, tuning guidance, and how they fit the GitOps flow.
- `hydrate.js` — One-time bulk ingestion using best-practice cursor pagination (`lower_bound` + sort by asset_id). Respects rate limits, extracts templates + assets, updates manifest. Has clear DEMO_LIMIT safety. Config-driven.
- `delta-sync.js` — Daily incremental updater (new mints via `after=` + burns via `burned=true`). Currently a **well-documented, copy-paste-ready skeleton** with exact patterns from hydrate.js. The team only needs to implement the merge logic (5–10 min work). Once done, the nightly job is fully autonomous.
- `calculate-rarity.js` — The core engine that delivers everything WAXFAMs asked for. Filters only survivors, groups by template, assigns surviving_mint_rank, applies the full weighted formula (template supply weight + mint bonuses + rarity name multipliers + variation multiplier). Outputs template_stats, trait_exposure (split), and leaderboard. Fully config-driven for all weights. Optional GZIP output.

### `demo/` Folder (The Beautiful Public Face)
- `README.md` — Complete guide to the dashboard, how it loads real generated JSONs, production deployment (Vercel/Netlify + jsDelivr), honest "no wallet login required" philosophy, deprecated tool warnings (Anchor), WharfKit positioning, and how to evolve it into a full Next.js app later.
- `index.html` — Self-contained, stunning single-file interactive dashboard (Tailwind + Font Awesome via CDN). Tabs for Overview, Template Stats, Trait Exposure, Holder Leaderboard, Rarity Rankings. Dynamic loading of the JSON files. Asset detail modal with original mint # + surviving rank + weighted score. Search/filter, keyboard shortcuts (`/` search, `Esc` close, `?` help). "Simulate Holdings (Demo)" button only — clearly labeled as illustration only. No misleading claims. Dark crypto aesthetic, fully responsive.

### Why This Structure Is Educational & Hand-off Ready
Every folder has its own README.md so you (or an AI coding assistant) can dive deep into any part without reading the entire root file. The root README gives the big picture and formulas. The scripts are heavily commented. Sample data makes everything runnable in < 30 seconds. Config.json means non-devs can tune weights safely.

This is deliberately designed so a non-technical community member or an AI worker can understand the full system, run it, and extend it (add more collections, change scoring, build a fancier frontend, migrate to Postgres, etc.).

---

## Data Outputs Explained

All files live in `/data/` and are committed to the repo.

| File                        | Purpose                                                                 | Updated by              | Key Fields |
|-----------------------------|-------------------------------------------------------------------------|------------------------|------------|
| `manifest.json`             | Sync state (last timestamp, totals)                                     | hydrate + delta-sync    | `last_sync_timestamp`, `total_minted`, `active_supply` |
| `templates.json`            | Master template dictionary (max supply, immutable traits)               | hydrate                 | `template_id`, `max_supply`, `immutable_data` |
| `schemas/gkniftyheads.json` | Full asset records (one file per schema for manageability)              | hydrate + delta-sync    | `asset_id`, `template_id`, `template_mint`, `owner`, `burned`, `attributes` |
| `template_stats.json`       | Live stats per template                                                 | calculate-rarity        | `surviving_count`, `burn_rate_percent`, `lowest/highest_surviving_mint`, `avg_rarity_score` |
| `trait_exposure.json`       | Live % exposure of every trait among current survivors (split rarity vs variation) | calculate-rarity | `rarity_traits`, `variation_traits` |
| `leaderboard.json`          | Holder leaderboard (top 50 by weighted rarity sum) + top 100 rarity assets | calculate-rarity | `holder_leaderboard`, `rarity_leaderboard` (with `surviving_mint_rank`, `weighted_rarity_score`, `original_template_mint`) |

**Pro tip**: Enable GZIP on your web server / CDN for these JSON files — they compress ~70-80%.

---

## Weighted Rarity + Surviving Mint Rank Algorithm

### Core Principles (transparent & tunable)
1. Only **surviving** (non-burned + has owner) assets count toward rankings and exposure.
2. **Surviving Mint Rank** = position when survivors of a template are sorted by their original `template_mint` ascending. Rank 1 = the lowest original mint number still alive in that template.
3. **Weighted Rarity Score** = statistical rarity + business rules that matter for GK Nifty Heads.

### Formula (current defaults — see `calculate-rarity.js` to tune)

```js
baseScore = Σ (totalSurvivors / traitFrequency) for every trait on the asset

templateWeight = 10000 / templateMaxSupply          // smaller templates = higher weight
mintBonus = (mint <= 10 ? 250 : mint === 69 ? 180 : mint <= 100 ? 80 : 0)

weightedScore = baseScore * (0.7 + 0.3 * templateWeight) + mintBonus

if (hasLegendary || has1of1 || hasMythic) weightedScore *= 1.25
if (hasSpecialVariation) weightedScore *= 1.15

final = parseFloat(weightedScore.toFixed(2))
```

**Why these weights?**
- Statistical base gives classic rarity.
- Template supply weight rewards rarer overall drops.
- Mint bonuses celebrate early/original minters (especially #1–10 and special numbers like 69).
- Legendary/1/1 and special variation multipliers reflect collector perception in the GK Nifty Heads community.

All weights and thresholds are in one place in `calculate-rarity.js` — easy for the WAXFAMs team to adjust.

---

## Scripts Documentation

See the dedicated `scripts/README.md` for full details on each script, how to run them, configuration, and expected behavior.

Quick reference:
- `hydrate.js` — One-time bulk download (cursor pagination, safe for 125k+)
- `delta-sync.js` — Daily incremental (mints via `after=` + burns via `burned=true`)
- `calculate-rarity.js` — Weighted scoring, surviving ranks, trait exposure, leaderboards

---

## Automation with GitHub Actions

The workflow `.github/workflows/daily-sync.yml` is ready to enable.

It:
1. Checks out code
2. Runs `npm install`
3. Executes `node scripts/delta-sync.js` (or full calculate if needed)
4. Runs `node scripts/calculate-rarity.js`
5. Commits any changes with message "chore: daily gkniftyheads update"
6. Pushes back to main

You can also trigger it manually from the Actions tab.

**Recommended schedule**: Once per day at a quiet hour (e.g., 02:00 UTC).

---

## Frontend / Demo

Open `demo/index.html` directly in a browser for an instant beautiful dashboard showing:
- Template stats cards (surviving supply, burn rate, min/max mint)
- Live Trait Exposure bars (rarity traits vs variation traits)
- Holder Leaderboard (top by weighted rarity sum)
- Rarity Leaderboard with surviving mint rank, original mint #, weighted score, tier badges
- Searchable/filterable tables
- Asset detail modal
- "Your Holdings" demo section (pure simulation — no login required)

**Making it production-ready**:
- The demo already dynamically loads `/data/*.json`
- No wallet connection is needed for the core public rankings & leaderboards (this is by design)
- (Optional future) Add personalized views in a full Next.js frontend using WharfKit if desired
- Deploy the `demo/` folder (or convert to Next.js) to Vercel/Netlify
- Use jsDelivr CDN links for the JSON files so updates appear instantly worldwide with zero cost.

See `demo/README.md` for the important note on wallet integration.

See `demo/README.md` for more.

---

## Customization Guide

### Tuning the weighting formula
Edit `scripts/calculate-rarity.js`:
- Change `mintBonus` thresholds and values
- Adjust multipliers for Legendary / variation
- Modify `templateWeight` base (currently 10000)
- Add new special mint rules (e.g., #420, #777, etc.)

### Adding more collections
1. Extend `hydrate.js` and `delta-sync.js` to loop over multiple collection names.
2. Store data under `data/schemas/<collection>.json`
3. Update `calculate-rarity.js` to process multiple schemas.
4. Update manifest and leaderboards accordingly.

### Changing output format
All write logic is centralized in `calculate-rarity.js` — easy to add new JSON files or fields.

### GZIP compression (recommended)
Add this after writing JSON files:
```js
import { gzip } from 'zlib';
import { promisify } from 'util';
const gzipAsync = promisify(gzip);
// then write .json.gz alongside .json
```

---

## WAX AtomicAssets API Best Practices

**Highly recommended reading:**  
[Working with the Atomic API](https://onblock.dev/working-with-the-atomic-api) — excellent practical guide from the WAX ecosystem covering efficient patterns, common pitfalls, and modern recommendations.

Key practices we follow (and expand on):
- **Cursor-based pagination** (`lower_bound` on `asset_id` + `sort=asset_id&order=asc`) for initial hydration — avoids the deep-page performance cliff that `page=` causes on large collections.
- **Delta sync with time anchors**:
  - New mints: `?collection_name=gkniftyheads&after=TIMESTAMP&sort=created&order=asc`
  - Burns: `?collection_name=gkniftyheads&burned=true&after=TIMESTAMP&sort=updated&order=asc`
- **Rate-limit friendly batching**: Current scripts use 500–1000 items per request + `sleep(200ms)`. The onblock guide recommends up to `limit=1000` (max allowed) and casting limit/page as strings when using POST.
- **Batch fetching when possible**: For templates or known IDs, use `?ids=comma,separated,list` to fetch many in one call (reduces round-trips dramatically).
- **Multiple public endpoints / redundancy**: Rotate or fallback across guild-operated nodes (e.g. `https://wax-atomic.alcor.exchange/atomicassets/v1/...` and others listed at https://validate.eosnation.io/wax/reports/endpoints.html#atomic_https). Never rely on a single node.
- **POST for very large/complex queries**: GET query strings have length limits; switch to POST and stringify numeric params (`limit`, `page`) — the `@wharfkit/atomicassets` SDK handles this automatically.
- **Key fields to capture**: `asset_id`, `template_id`, `template_mint`, `owner`, `burned` / `burned_at_time`, `updated_at_time`, `attributes` (or `immutable_data`).
- `template_mint` is essential for our surviving mint rank feature.

**Optional production upgrade**: For typed responses and automatic POST handling, consider adding `@wharfkit/atomicassets` (best with TypeScript/React projects). Our current zero-dependency `node-fetch` approach keeps the GitOps pipeline simple and serverless-friendly.

Full official reference: https://atomicassets.io/ and Swagger docs at https://wax-atomic.alcor.exchange/docs/

---

## Scaling & Performance

- **125k assets**: Current scripts handle comfortably in GitHub Actions (a few minutes).
- **500k assets**: Still fine — the bottleneck is only the initial hydration. Daily delta is tiny.
- Memory: Everything is loaded into RAM for simplicity. For very large future collections you can stream JSON processing.
- File size: Split by schema + GZIP keeps individual files small and fast to load in browser.

---

## Migration Path to Full Backend

If you later need:
- Sub-hourly updates
- User accounts / watchlists
- Real-time WebSocket updates
- Complex queries across many collections

Then migrate to **Option 3** (PostgreSQL + Node/Python cron):
- Keep the same delta logic.
- Replace flat JSON writes with `INSERT ... ON CONFLICT` into `assets` and `templates` tables.
- Add indexes on `template_id`, `is_burned`, `owner`.
- The rarity calculation becomes a nightly materialized view or background job.
- Frontend queries the DB (or a read-replica) instead of static JSON.

A branch or separate folder with a Postgres implementation can be added later if requested.

---

## Troubleshooting

| Problem                        | Likely Cause                              | Solution |
|--------------------------------|-------------------------------------------|----------|
| `calculate-rarity.js` syntax error | File was truncated in early version      | Use the fixed version in this v0.2 |
| No new data after daily run    | Delta-sync is still placeholder          | Implement full mint/burn logic (see scripts/README) |
| Demo shows old data            | Browser cache or static file             | Hard refresh or use dynamic loader (already in v0.2) |
| API rate limits                | Too large batch or no sleep              | Reduce BATCH_SIZE to 200–300, increase sleep |
| Burned assets still ranking    | Filter not applied                       | Ensure `!a.burned && a.owner` filter is active |

---

## Contributing & Next Steps

This repo is designed to be the starting point for the WAXFAMs community's GK Nifty Heads platform and future expansions.

**Immediate next steps for the team**:
1. Remove the demo safety limit in `hydrate.js` and run full collection hydration.
2. Implement the real logic in `delta-sync.js` (full mint + burn handling + merging into schema files).
3. Tune weighting numbers with community feedback.
4. Build a proper Next.js frontend on top of the JSON outputs.
5. (Optional) Add personalized "My Holdings" highlighting in a full frontend using a modern WAX library (WharfKit recommended for React/TS apps). Note: Core rankings work perfectly without any login.

Pull requests that improve documentation, add multi-collection support, or enhance the weighting logic are very welcome.

**License**: MIT (free for anyone in the WAX ecosystem to use and adapt).

---

**Built with ❤️ for the WAXFAMs & GK Nifty Heads community.**

If you have questions or want expansions (multi-collection, Postgres branch, Next.js frontend scaffold, Discord bot, etc.), open an issue or contact the maintainers.