import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SCHEMAS_DIR = path.join(DATA_DIR, 'schemas');

async function readJSON(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

async function calculateRarity() {
  console.log('Calculating rarity scores and building leaderboards...');

  const assets = await readJSON(path.join(SCHEMAS_DIR, 'gkniftyheads.json'));
  const activeAssets = assets.filter(a => !a.burned && a.owner);

  if (activeAssets.length === 0) {
    console.log('No active assets found.');
    return;
  }

  // 1. Count trait frequencies
  const traitCounts = {};
  for (const asset of activeAssets) {
    for (const attr of (asset.attributes || asset.data || [])) {
      const key = `${attr.trait_type || attr.key}:${attr.value || attr.val}`;
      traitCounts[key] = (traitCounts[key] || 0) + 1;
    }
  }

  const totalActive = activeAssets.length;

  // 2. Calculate rarity score for each asset
  for (const asset of activeAssets) {
    let score = 0;
    for (const attr of (asset.attributes || asset.data || [])) {
      const key = `${attr.trait_type || attr.key}:${attr.value || attr.val}`;
      const freq = traitCounts[key] || 1;
      score += totalActive / freq;
    }
    asset.rarity_score = parseFloat(score.toFixed(2));
  }

  // 3. Sort by rarity (descending)
  const rarityRanked = [...activeAssets].sort((a, b) => b.rarity_score - a.rarity_score);

  // 4. Build holder leaderboard (by asset count + rarity sum)
  const holders = {};
  for (const asset of activeAssets) {
    const owner = asset.owner;
    if (!holders[owner]) {
      holders[owner] = { assets_count: 0, rarity_sum: 0, assets: [] };
    }
    holders[owner].assets_count += 1;
    holders[owner].rarity_sum += asset.rarity_score;
    holders[owner].assets.push(asset.asset_id);
  }

  const holderLeaderboard = Object.entries(holders)
    .map(([wallet, stats]) => ({
      wallet,
      assets_count: stats.assets_count,
      rarity_sum: parseFloat(stats.rarity_sum.toFixed(2)),
      top_assets: stats.assets.slice(0, 3)
    }))
    .sort((a, b) => b.assets_count - a.assets_count || b.rarity_sum - a.rarity_sum)
    .slice(0, 50); // Top 50 for demo; increase or paginate in prod

  // 5. Create final leaderboard.json
  const leaderboard = {
    last_updated: new Date().toISOString(),
    collection: {
      name: 'gkniftyheads',
      total_minted: assets.length,
      active_supply: activeAssets.length,
      burned: assets.length - activeAssets.length
    },
    holder_leaderboard: holderLeaderboard,
    rarity_leaderboard: rarityRanked.slice(0, 100).map((asset, index) => ({
      rank: index + 1,
      asset_id: asset.asset_id,
      template_id: asset.template_id,
      rarity_score: asset.rarity_score,
      owner: asset.owner,
      traits: (asset.attributes || asset.data || []).reduce((acc, t) => {
        acc[t.trait_type || t.key] = t.value || t.val;
        return acc;
      }, {})
    }))
  };

  await fs.writeFile(
    path.join(DATA_DIR, 'leaderboard.json'),
    JSON.stringify(leaderboard, null, 2)
  );

  console.log(`✅ Rarity calculation complete.`);
  console.log(`   Active assets: ${activeAssets.length}`);
  console.log(`   Unique holders (top 50 shown): ${holderLeaderboard.length}`);
  console.log(`   Top rarity asset: #${rarityRanked[0]?.asset_id} (score ${rarityRanked[0]?.rarity_score})`);
}

calculateRarity().catch(console.error);