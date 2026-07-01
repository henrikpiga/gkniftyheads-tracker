# demo/

This folder contains a **beautiful, self-contained, production-feeling interactive dashboard** that demonstrates exactly what the full pipeline outputs.

It is intentionally a single HTML file (`index.html`) so anyone can open it instantly in a browser with zero setup — perfect for quick validation and stakeholder demos.

## Current Features (v0.2)

- **Dashboard overview** with key collection metrics
- **Template Stats cards** — live surviving supply, burn rate %, lowest/highest surviving mint per template
- **Live Trait Exposure** tab with nice percentage bars (rarity traits vs variation traits)
- **Holder Leaderboard** — top wallets by weighted rarity sum + asset count
- **Rarity Leaderboard** — top 100 rarest surviving assets with:
  - Original Mint #
  - Surviving Mint Rank (within template)
  - Weighted Rarity Score + Base Score (transparent)
  - Rarity tier badges (Legendary / Epic / Rare / etc.)
- **Search & filter** across both leaderboards
- **Asset detail modal** — click any row to see full traits + metadata
- **"Your Holdings"** section (demo mode connected to `waxman.wam`)
- Dark crypto aesthetic with Tailwind + Font Awesome (all via CDN)

## How the Demo Loads Data (Important)

In v0.2 the demo **dynamically fetches** the JSON files from the same folder structure:
- It looks for `../data/leaderboard.json`, `../data/template_stats.json`, etc.
- When you open `demo/index.html` directly from the file system, it may need a small local server (or you can hard-refresh / use the "Load Sample Data" fallback that is included).

When deployed (Vercel, GitHub Pages, Netlify), it works perfectly because relative paths resolve correctly.

## Making It Production-Ready

### Option A — Quick & Free (Recommended for start)
1. Deploy the entire `demo/` folder to **Vercel** or **Netlify** (drag & drop or Git connect).
2. Point the JSON URLs to the jsDelivr CDN of your repo:
   ```js
   const BASE = 'https://cdn.jsdelivr.net/gh/henrikpiga/gkniftyheads-tracker@main/data/';
   ```
3. (Optional) Add personalized "My Holdings" view using a modern WAX wallet library (see note below).

### Option B — Full Next.js / React App (when you want more power)
- Convert this single-file demo into a proper Next.js project.
- Use React Table / TanStack Table for the leaderboards (better performance + sorting).
- Add infinite scroll or virtualized lists if you ever show more than top 100/500.
- Implement personalized "My Holdings" using real wallet login + on-chain verification.

## Important Note: No Wallet Login Required (Core Use Case)

**The GK Nifty Heads Tracker is designed as a fully public dashboard.**

- No wallet connection, login, or personal data is ever needed to view rankings, leaderboards, template stats, trait exposure, or surviving mint ranks.
- Everything you see in `demo/index.html` (and the production version) is generated from public on-chain data via the AtomicAssets API.
- The "Simulate Holdings (Demo)" button is purely for illustration — it shows example holdings so visitors understand what a personalized view could look like.

### When You Might Want Optional Wallet Integration Later

If you later build a full interactive frontend (Next.js / React) and want to offer **personalized features** such as:
- Highlighting the visitor’s own assets in the rarity table
- Showing “Your weighted rarity rank among all holders”
- One-click “claim” or social features

…then you can add wallet connection.

**Recommended modern library:** WharfKit (actively maintained by the WAX ecosystem).

**Important warnings:**
- **Anchor (AnchorLink) is deprecated** — do not use it in new projects.
- **Legacy WaxJS is no longer recommended.**
- WharfKit works best in React / TypeScript projects. For a simple static HTML demo like this one, real wallet integration adds unnecessary complexity.

### Quick WharfKit Integration (Future Full App Only)

If you decide to add it later in a Next.js project:

```bash
npm install @wharfkit/session @wharfkit/web-renderer
```

Basic pattern (React/Next.js):
```js
// See WharfKit docs for full example
```