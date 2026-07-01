# Demo Dashboard

This folder contains a fully self-contained, production-quality reference implementation of the frontend.

`index.html` is a single-file Tailwind + vanilla JS application that demonstrates every major feature:

- Live template stats with surviving supply & burn rates
- Weighted rarity leaderboard with surviving mint ranks
- Trait exposure percentage bars (rarity vs variation)
- Asset detail modal showing original mint # and surviving rank
- Search & filtering across all views
- Fake wallet connection flow

**How to use in production**:
1. Copy the structure and components into your Next.js / Vite project
2. Replace the hardcoded `sampleData` with real `fetch()` calls to the jsDelivr CDN URLs of your JSON files
3. Add real WAX wallet connection using WaxJS or Anchor
4. Style to match your brand

The demo is intentionally kept as one file so you can open it instantly and understand the data model and UX patterns.