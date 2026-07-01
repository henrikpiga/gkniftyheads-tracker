import fs from 'fs/promises';
import path from 'path';
import { gzipSync } from 'zlib'; // for optional GZIP output

const DATA_DIR = path.join(process.cwd(), 'data');
const SCHEMAS_DIR = path.join(DATA_DIR, 'schemas');

// Load configuration
let CONFIG;
try {
  const configContent = await fs.readFile(path.join(process.cwd(), 'config.json'), 'utf8');
  CONFIG = JSON.parse(configContent);
} catch {
  CONFIG = {
    weights: {
      templateSupplyWeight: 0.3,
      mintNumberBonus: { top10: 5.0, top100: 2.0, special69: 3.0, under1000: 1.0 },
      rarityNameMultipliers: { Legendary: 4.0, Mythic: 3.5, Epic: 2.5, '1/1': 5.0, Rare: 1.8, Uncommon: 1.3, Common: 1.0 },
      variationMultiplier: 1.8
    },
    gzipOutputs: false,
    maxRarityLeaderboard: 100
  };
}

const WEIGHTS = CONFIG.weights || {};
const GZIP_OUTPUTS = CONFIG.gzipOutputs || false;

async function readJSON(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

async function writeJSON(filePath, data) {
  const jsonStr = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, jsonStr);

  if (GZIP_OUTPUTS) {
    try {
      const gzipped = gzipSync(Buffer.from(jsonStr));
      await fs.writeFile(filePath + '.gz', gzipped);
      console.log(`   📦 Gzipped: ${path.basename(filePath)}.gz (${(gzipped.length / 1024).toFixed(1)} KB)`);
    } catch (e) {
      console.warn('   GZIP write failed (non-critical):', e.message);
    }
  }
}

// Helper: safe log (unused in current formula but available for future log-based scoring)
function safeLog(x) {
  return Math.log(Math.max(x, 2));
}

async function calculateRarity() {
  console.log('Calculating WEIGHTED rarity, surviving mint ranks, trait exposure for gkniftyheads...');

  const assets = await readJSON(path.join(SCHEMAS_DIR, 'gkniftyheads.json'));
  const activeAssets = assets.filter(a => !a.burned && a.owner);

  if (activeAssets.length === 0) {
    console.log('No active assets found. Exiting.');
    return;
  }

  const totalSurvivors = activeAssets.length;
  console.log(`Processing ${totalSurvivors} surviving assets...`);

  // 1. Trait frequency counts (only among survivors)
  // Handles both array form [{trait_type, value}] and object form {rarity: "Common", variation: "Classic"}
  const traitCounts = {};
  for (const asset of activeAssets) {
    const attrs = asset.attributes || asset.data || {};
    if (Array.isArray(attrs)) {
      for (const attr of attrs) {
        const key = `${attr.trait_type || attr.key}:${attr.value || attr.val}`;
        traitCounts[key] = (traitCounts[key] || 0) + 1;
      }
    } else if (typeof attrs === 'object') {
      for (const [key, value] of Object.entries(attrs)) {
        const traitKey = `${key}:${value}`;
        traitCounts[traitKey] = (traitCounts[traitKey] || 0) + 1;
      }
    }
  }

  // 2. Group by template for surviving mint ranks + template stats
  const byTemplate = {};
  for (const asset of activeAssets) {
    const tid = asset.template_id;
    if (!byTemplate[tid]) {
      byTemplate[tid] = {
        assets: [],
        max_supply: asset.template_max_supply || 10000,
        original_mints: new Set()
      };
    }
    byTemplate[tid].assets.push(asset);
    if (asset.template_mint) byTemplate[tid].original_mints.add(asset.template_mint);
  }

  // 3. For each template: sort by original template_mint and assign surviving_mint_rank
  const templateStats = {};
  for (const [tid, group] of Object.entries(byTemplate)) {
    const sorted = group.assets.sort((a, b) => 
      (a.template_mint || 999999) - (b.template_mint || 999999)
    );
    
    sorted.forEach((asset, index) => {
      asset.surviving_mint_rank = index + 1;
      asset.original_template_mint = asset.template_mint || null;
    });

    const survivingCount = sorted.length;
    const burnRate = group.max_supply > 0 
      ? parseFloat(((group.max_supply - survivingCount) / group.max_supply * 100).toFixed(1)) 
      : 0;

    templateStats[tid] = {
      template_id: parseInt(tid),
      original_max_supply: group.max_supply,
      surviving_count: survivingCount,
      burn_rate_percent: burnRate,
      avg_rarity_score: 0,
      lowest_surviving_mint: sorted[0]?.template_mint || null,
      highest_surviving_mint: sorted[sorted.length - 1]?.template_mint || null
    };
  }

  // 4. Calculate base + WEIGHTED rarity score for every surviving asset
  for (const asset of activeAssets) {
    let baseScore = 0;
    let hasLegendary = false;
    let hasSpecialVariation = false;

    const attrs = asset.attributes || asset.data || {};
    if (Array.isArray(attrs)) {
      for (const attr of attrs) {
        const key = `${attr.trait_type || attr.key}:${attr.value || attr.val}`;
        const freq = traitCounts[key] || 1;
        baseScore += totalSurvivors / freq;

        const valLower = (attr.value || attr.val || '').toString().toLowerCase();
        if (valLower.includes('legendary') || valLower.includes('1/1') || valLower.includes('mythic')) {
          hasLegendary = true;
        }
        if (valLower.includes('variation') || valLower.includes('special') || valLower.includes('unique')) {
          hasSpecialVariation = true;
        }
      }
    } else if (typeof attrs === 'object') {
      for (const [k, v] of Object.entries(attrs)) {
        const key = `${k}:${v}`;
        const freq = traitCounts[key] || 1;
        baseScore += totalSurvivors / freq;

        const valLower = v.toString().toLowerCase();
        if (valLower.includes('legendary') || valLower.includes('1/1') || valLower.includes('mythic')) {
          hasLegendary = true;
        }
        if (valLower.includes('variation') || valLower.includes('special') || valLower.includes('unique')) {
          hasSpecialVariation = true;
        }
      }
    }

    // === WEIGHTED RARITY LOGIC (driven by config.json - fully tunable by community) ===
    const templateMaxSupply = byTemplate[asset.template_id]?.max_supply || 10000;
    const templateWeight = (WEIGHTS.templateSupplyWeight || 0.3) * (10000 / templateMaxSupply);
    
    const mint = asset.original_template_mint || 999999;
    let mintBonus = 0;
    const mb = WEIGHTS.mintNumberBonus || {};
    if (mint <= 10) mintBonus = mb.top10 || 5.0;
    else if (mint === 69) mintBonus = mb.special69 || 3.0;
    else if (mint <= 100) mintBonus = mb.top100 || 2.0;
    else if (mint < 1000) mintBonus = mb.under1000 || 1.0;

    // Base statistical rarity scaled by template rarity weight
    let weightedScore = baseScore * (1 - (WEIGHTS.templateSupplyWeight || 0.3) + templateWeight);
    weightedScore += mintBonus * 50; // scale bonus to be meaningful alongside statistical scores

    // Apply rarity name & variation multipliers from config
    const rarityMult = WEIGHTS.rarityNameMultipliers || {};
    if (hasLegendary) {
      const key = Object.keys(rarityMult).find(k => hasLegendary && (k.toLowerCase().includes('legendary') || k === '1/1' || k.toLowerCase().includes('mythic'))) || 'Legendary';
      weightedScore *= (rarityMult[key] || 1.25);
    }
    if (hasSpecialVariation) {
      weightedScore *= (WEIGHTS.variationMultiplier || 1.8);
    }

    asset.weighted_rarity_score = parseFloat(weightedScore.toFixed(2));
    asset.base_rarity_score = parseFloat(baseScore.toFixed(2));
  }

  // 5. Build rarity leaderboard (sorted by weighted score)
  const rarityRanked = [...activeAssets].sort((a, b) => 
    b.weighted_rarity_score - a.weighted_rarity_score
  );

  // Fill avg rarity in templateStats
  for (const tid in templateStats) {
    const tAssets = byTemplate[tid].assets;
    if (tAssets.length > 0) {
      const avg = tAssets.reduce((sum, a) => sum + (a.weighted_rarity_score || 0), 0) / tAssets.length;
      templateStats[tid].avg_rarity_score = parseFloat(avg.toFixed(2));
    }
  }

  // 6. Holder leaderboard (top 50 by weighted rarity sum)
  const holders = {};
  for (const asset of activeAssets) {
    const owner = asset.owner;
    if (!holders[owner]) {
      holders[owner] = { assets_count: 0, rarity_sum: 0, assets: [] };
    }
    holders[owner].assets_count += 1;
    holders[owner].rarity_sum += asset.weighted_rarity_score || 0;
    holders[owner].assets.push(asset.asset_id);
  }

  const holderLeaderboard = Object.entries(holders)
    .map(([wallet, stats]) => ({
      wallet,
      assets_count: stats.assets_count,
      rarity_sum: parseFloat(stats.rarity_sum.toFixed(2)),
      assets: stats.assets.slice(0, 10) // top 10 asset ids for brevity
    }))
    .sort((a, b) => b.rarity_sum - a.rarity_sum)
    .slice(0, 50);

  // 7. Write outputs
  await writeJSON(path.join(DATA_DIR, 'template_stats.json'), templateStats);
  await writeJSON(path.join(DATA_DIR, 'trait_exposure.json'), {
    rarity_traits: Object.entries(traitCounts).filter(([k]) => k.toLowerCase().includes('rarity') || k.toLowerCase().includes('legendary') || k.toLowerCase().includes('epic')).slice(0, 20),
    variation_traits: Object.entries(traitCounts).filter(([k]) => k.toLowerCase().includes('variation') || k.toLowerCase().includes('special') || k.toLowerCase().includes('unique')).slice(0, 20),
    total_survivors: totalSurvivors,
    note: 'Percentages calculated live from current surviving assets only'
  });
  await writeJSON(path.join(DATA_DIR, 'leaderboard.json'), {
    holder_leaderboard: holderLeaderboard,
    rarity_leaderboard: rarityRanked.slice(0, CONFIG.maxRarityLeaderboard || 100).map(a => ({
      asset_id: a.asset_id,
      template_id: a.template_id,
      original_mint: a.original_template_mint,
      surviving_mint_rank: a.surviving_mint_rank,
      weighted_rarity_score: a.weighted_rarity_score,
      base_rarity_score: a.base_rarity_score,
      owner: a.owner,
      traits: a.attributes
    })),
    generated_at: new Date().toISOString(),
    total_survivors: totalSurvivors
  });

  console.log('\n✅ Rarity calculation complete.');
  console.log(`   - ${Object.keys(templateStats).length} templates processed`);
  if (holderLeaderboard.length > 0) {
    console.log(`   - Top holder: ${holderLeaderboard[0].wallet} (${holderLeaderboard[0].rarity_sum} weighted rarity)`);
  }
  if (rarityRanked.length > 0) {
    console.log(`   - Rarest asset: #${rarityRanked[0].asset_id} (score ${rarityRanked[0].weighted_rarity_score})`);
  }
  console.log('   Outputs: template_stats.json, trait_exposure.json, leaderboard.json (+ .gz if enabled)\n');
}

calculateRarity().catch(console.error);