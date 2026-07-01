import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SCHEMAS_DIR = path.join(DATA_DIR, 'schemas');

async function readJSON(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

async function writeJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Helper: safe log for weighting
function safeLog(x) {
  return Math.log(Math.max(x, 2));
}

async function calculateRarity() {
  console.log('Calculating WEIGHTED rarity, surviving mint ranks, trait exposure for gkniftyheads...');

  const assets = await readJSON(path.join(SCHEMAS_DIR, 'gkniftyheads.json'));
  const activeAssets = assets.filter(a => !a.burned && a.owner);

  if (activeAssets.length === 0) {
    console.log('No active assets.');
    return;
  }

  const totalSurvivors = activeAssets.length;

  // 1. Trait frequency counts (only among survivors)
  const traitCounts = {};
  for (const asset of activeAssets) {
    for (const attr of (asset.attributes || asset.data || [])) {
      const key = `${attr.trait_type || attr.key}:${attr.value || attr.val}`;
      traitCounts[key] = (traitCounts[key] || 0) + 1;
    }
  }

  // 2. Group by template for surviving mint ranks + template stats
  const byTemplate = {};
  for (const asset of activeAssets) {
    const tid = asset.template_id;
    if (!byTemplate[tid]) {
      byTemplate[tid] = {
        assets: [],
        max_supply: asset.template_max_supply || 10000, // fallback
        original_mints: new Set()
      };
    }
    byTemplate[tid].assets.push(asset);
    if (asset.template_mint) byTemplate[tid].original_mints.add(asset.template_mint);
  }

  // 3. For each template: sort by original template_mint and assign surviving_mint_rank
  const templateStats = {};
  for (const [tid, group] of Object.entries(byTemplate)) {
    // Sort surviving assets by their ORIGINAL template_mint (ascending = lower mint # first)
    const sorted = group.assets.sort((a, b) => (a.template_mint || 999999) - (b.template_mint || 999999));
    
    sorted.forEach((asset, index) => {
      asset.surviving_mint_rank = index + 1;                    // 1 = lowest original mint among survivors
      asset.original_template_mint = asset.template_mint || null;
    });

    const survivingCount = sorted.length;
    const burnRate = group.max_supply > 0 ? ((group.max_supply - survivingCount) / group.max_supply * 100).toFixed(1) : 0;

    templateStats[tid] = {
      template_id: parseInt(tid),
      original_max_supply: group.max_supply,
      surviving_count: survivingCount,
      burn_rate_percent: parseFloat(burnRate),
      avg_rarity_score: 0, // filled later
      lowest_surviving_mint: sorted[0]?.template_mint || null,
      highest_surviving_mint: sorted[sorted.length-1]?.template_mint || null
    };
  }

  // 4. Calculate base + WEIGHTED rarity score for every surviving asset
  for (const asset of activeAssets) {
    let baseScore = 0;
    let hasLegendary = false;
    let hasSpecialVariation = false;

    for (const attr of (asset.attributes || asset.data || [])) {
      const key = `${attr.trait_type || attr.key}:${attr.value || attr.val}`;
      const freq = traitCounts[key] || 1;
      baseScore += totalSurvivors / freq;

      // Detect rarity name / special variation for weighting
      const valLower = (attr.value || attr.val || '').toString().toLowerCase();
      if (valLower.includes('legendary') || valLower.includes('1/1') || valLower.includes('mythic')) {
        hasLegendary = true;
      }
      if (valLower.includes('variation') || valLower.includes('special') || valLower.includes('unique')) {
        hasSpecialVariation = true;
      }
    }

    // === WEIGHTED RARITY LOGIC (customizable per Waxman) ===
    const templateWeight = 10000 / (byTemplate[asset.template_id]?.max_supply || 10000); // smaller template = higher weight
    const mintBonus = asset.original_template_mint <= 10 ? 250 : 
                      asset.original_template_mint === 69 ? 180 :
                      asset.original_template_mint <= 100 ? 80 : 0;
    
    let weightedScore = baseScore * (0.7 + 0.3 * templateWeight); // base 70% + template weight 30%
    weightedScore += mintBonus;

    if (hasLegendary) weightedScore *= 1.25;           // Rarity name bonus
    if (hasSpecialVariation) weightedScore *= 1.15;     // Variation trait bonus

    asset.weighted_rarity_score = parseFloat(weightedScore.toFixed(2));
    asset.base_rarity_score = parseFloat(baseScore.toFixed(2));
  }

  // 5. Re-sort activeAssets by weighted rarity for global leaderboard
  const rarityRanked = [...activeAssets].sort((a, b) => b.weighted_rarity_score - a.weighted_rarity_score);

  // Fill avg rarity in templateStats
  for (const tid in templateStats) {
    const tAssets = byTemplate[tid].assets;
    if (tAssets.length > 0) {
      const avg = tAssets.reduce((sum, a) => sum + (a.weighted_rarity_score || 0), 0) / tAssets.length;
      templateStats[tid].avg_rarity_score = parseFloat(avg.toFixed(2));
    }
  }

  // 6. Holder leaderboard (by count + weighted rarity sum)
  const holders = {};
  for (const asset of activeAssets) {
    const owner = asset.owner;
    if (!holders[owner]) holders[owner] = { assets_count: 0, rarity_sum: 0, assets: [] };
    holders[owner].assets_count += 1;
    holders[owner].rarity_sum += asset.weighted_rarity_score || 0;
    holders[owner].assets.push(asset.asset_id);
  }

  const holderLeaderboard = Object.entries(holders)
    .map(([wallet, stats]) => ({
      wallet,
      assets_count: stats.assets_count,
      rarity_sum: parseFloat(stats.rarity_sum.toFixed(2)),
      top_assets: stats.assets.slice(0, 3)
    }))
    .sort((a, b) => b.rarity_sum - a.rarity_sum || b.assets_count - a.assets_count)
    .slice(0, 50);

  // 7. Build trait exposure (live % among survivors) - split rarity vs variation if possible
  const traitExposure = { rarity_traits: {}, variation_traits: {} };
  for (const [key, count] of Object.entries(traitCounts)) {
    const pct = parseFloat((count / totalSurvivors * 100).toFixed(2));
    if (key.toLowerCase().includes('rarity') || key.toLowerCase().includes('tier') || key.toLowerCase().includes('legendary')) {
      traitExposure.rarity_traits[key] = { count, percent_of_survivors: pct };
    } else {
      traitExposure.variation_traits[key] = { count, percent_of_survivors: pct };
    }
  }

  // 8. Final outputs
  const leaderboard = {
    last_updated: new Date().toISOString(),
    collection: {
      name: 'gkniftyheads',
      total_minted: assets.length,
      active_supply: totalSurvivors,
      burned: assets.length - totalSurvivors
    },
    holder_leaderboard: holderLeaderboard,
    rarity_leaderboard: rarityRanked.slice(0, 100).map((asset, index) => ({
      rank: index + 1,
      asset_id: asset.asset_id,
      template_id: asset.template_id,
      original_template_mint: asset.original_template_mint,
      surviving_mint_rank: asset.surviving_mint_rank,
      weighted_rarity_score: asset.weighted_rarity_score,
      base_rarity_score: asset.base_rarity_score,
      owner: asset.owner,
      traits: (asset.attributes || asset.data || []).reduce((acc, t) => {
        acc[t.trait_type || t.key] = t.value || t.val;
        return acc;
      }, {})
    }))
  };

  await writeJSON(path.join(DATA_DIR, 'leaderboard.json'), leaderboard);
  await writeJSON(path.join(DATA_DIR, 'template_stats.json'), templateStats);
  await writeJSON(path.join(DATA_DIR, 'trait_exposure.json'), traitExposure);

  console.log(`✅ Weighted rarity + surviving ranks + trait exposure complete.`);
  console.log(`   Active survivors: ${totalSurvivors}`);
  console.log(`   Templates tracked: ${Object.keys(templateStats).length}`);
  console.log(`   Top weighted asset: #${rarityRanked[0]?.asset_id} (score ${rarityRanked[0]?.weighted_rarity_score})`);
}

calculateRarity().catch(console.error);