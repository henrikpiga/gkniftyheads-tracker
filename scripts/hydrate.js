import fs from 'fs/promises';
import path from 'path';

// Simple sleep helper to respect API rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const API_BASE = 'https://wax.api.atomicassets.io/atomicassets/v1';
const COLLECTION = 'gkniftyheads';
const BATCH_SIZE = 500; // Adjust based on observed rate limits (max usually 1000)
const DELAY_MS = 250;   // Be nice to the public API

const DATA_DIR = path.join(process.cwd(), 'data');
const SCHEMAS_DIR = path.join(DATA_DIR, 'schemas');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fetchAssets(lowerBound = 0) {
  const params = new URLSearchParams({
    collection_name: COLLECTION,
    limit: BATCH_SIZE,
    order: 'asc',
    sort: 'asset_id',
    lower_bound: lowerBound.toString()
  });

  const url = `${API_BASE}/assets?${params.toString()}`;
  console.log(`Fetching: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function hydrateCollection() {
  console.log('Starting one-time hydration for gkniftyheads...');
  await ensureDir(DATA_DIR);
  await ensureDir(SCHEMAS_DIR);

  let lowerBound = 0;
  let totalFetched = 0;
  const allAssets = [];
  const templatesMap = new Map();

  while (true) {
    try {
      const data = await fetchAssets(lowerBound);
      const assets = data.data || [];

      if (assets.length === 0) {
        console.log('No more assets. Hydration complete.');
        break;
      }

      allAssets.push(...assets);
      totalFetched += assets.length;

      // Collect unique templates
      for (const asset of assets) {
        if (asset.template && !templatesMap.has(asset.template.template_id)) {
          templatesMap.set(asset.template.template_id, asset.template);
        }
      }

      // Update lower_bound for next iteration
      const lastAsset = assets[assets.length - 1];
      lowerBound = parseInt(lastAsset.asset_id) + 1;

      console.log(`Fetched ${assets.length} assets. Total so far: ${totalFetched}. Next lower_bound: ${lowerBound}`);

      await sleep(DELAY_MS);

      // Safety: stop after reasonable number in testing (remove for real run)
      if (totalFetched > 2000) {
        console.log('Demo limit reached (remove this in production).');
        break;
      }
    } catch (err) {
      console.error('Fetch error, retrying in 2s...', err.message);
      await sleep(2000);
    }
  }

  // Save templates
  const templates = Object.fromEntries(templatesMap);
  await fs.writeFile(
    path.join(DATA_DIR, 'templates.json'),
    JSON.stringify(templates, null, 2)
  );

  // For demo we save a combined schema file. In production split by schema_name if needed.
  await fs.writeFile(
    path.join(SCHEMAS_DIR, 'gkniftyheads.json'),
    JSON.stringify(allAssets, null, 2)
  );

  // Initial manifest
  const manifest = {
    last_sync_timestamp: new Date().toISOString(),
    collection_name: COLLECTION,
    total_minted: totalFetched,
    burned: 0,
    active_supply: totalFetched,
    unique_holders: new Set(allAssets.map(a => a.owner)).size
  };
  await fs.writeFile(
    path.join(DATA_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n✅ Hydration complete! ${totalFetched} assets saved.`);
  console.log('Next: run rarity calculation or set up the daily workflow.');
}

hydrateCollection().catch(console.error);