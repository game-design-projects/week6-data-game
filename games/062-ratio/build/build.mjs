// raw TheMealDB -> data.json : dishes with a quantified flour / liquid / fat / egg ratio.
import fs from 'node:fs';
const raw = [];
for (const l of 'abcdefghijklmnopqrstuvwxyz') raw.push(...(JSON.parse(fs.readFileSync(`raw/${l}.json`, 'utf8')).meals || []));

const GROUPS = [
  ['flour', /\b(flour|semolina|cornflour|cornmeal|masa)\b/i],
  ['egg', /^(eggs?|egg yolks?|egg whites?|free-range eggs?|duck eggs?)$/i],
  ['fat', /\b(butter|oil|lard|margarine|ghee|shortening|suet)\b/i],
  ['liquid', /^(water|milk|whole milk|full-fat milk|skimmed milk|buttermilk|double cream|heavy cream|single cream|cream|coconut milk|soy milk|almond milk|warm water|boiling water|cold water|ice water|sour cream|yogurt|yoghurt|greek yogurt)$/i],
  ['sugar', /\b(sugar|honey|syrup|molasses)\b/i],
];
const GRAM = { flour: [125, 8, 2.6], liquid: [240, 15, 5], fat: [220, 14, 4.5], sugar: [200, 12.5, 4.2], egg: [50, 50, 50] }; // cup, tbsp, tsp (g)
const FRAC = { '½': '.5', '¼': '.25', '¾': '.75', '⅓': '.333', '⅔': '.667' };

function qty(s) {
  s = s.toLowerCase().replace(/[½¼¾⅓⅔]/g, (c) => ' ' + FRAC[c]).trim();
  const m = s.match(/^(\d+(?:\.\d+)?)(?:\s*-\s*\d+)?(?:\s+(\d+)\/(\d+))?\s*(?:(\d+)\/(\d+))?\s*([a-z]*)/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2]) n += m[2] / m[3];
  const fr = s.match(/^(\d+)\/(\d+)/); if (fr) n = fr[1] / fr[2];
  return { n, u: m[6] };
}
function grams(group, measure) {
  const q = qty(measure || ''); if (!q) return null;
  const [cup, tbsp, tsp] = GRAM[group]; const { n, u } = q;
  if (group === 'egg') return /^(g|ml)$/.test(u) ? n : /^(large|medium|small|)$/.test(u) || /^egg/.test(u) ? n * 50 : null;
  if (u === 'g' || u === 'ml') return n;
  if (u === 'kg' || u === 'l') return n * 1000;
  if (/^cups?$/.test(u)) return n * cup;
  if (/^(tbsp|tbs|tblsp|tbls|tablespoons?)$/.test(u)) return n * tbsp;
  if (/^(tsp|teaspoons?)$/.test(u)) return n * tsp;
  if (/^(oz|ounces?)$/.test(u)) return n * 28.35;
  if (/^(lb|lbs|pounds?)$/.test(u)) return n * 454;
  return null;
}
const groupOf = (name) => { for (const [g, re] of GROUPS) if (re.test(name.trim())) return g; return null; };

const out = []; const seen = new Set(); const seenRatio = new Set();
for (const m of raw) {
  const tot = { flour: 0, liquid: 0, fat: 0, egg: 0, sugar: 0 }; let bad = false; const extra = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m['strIngredient' + i] || '').trim(); if (!name) continue;
    const g = groupOf(name);
    if (!g) { extra.push(name); continue; }
    const w = grams(g, m['strMeasure' + i]);
    if (w == null) { if (g !== 'sugar') bad = true; continue; }
    tot[g] += w;
  }
  if (bad || !tot.flour) continue;
  const have = ['liquid', 'fat', 'egg'].filter((k) => tot[k] > 0).length;
  if (have < 2) continue;
  const base = tot.flour + tot.liquid + tot.fat + tot.egg;
  if (base < 150 || base > 3000) continue;
  const pct = Object.fromEntries(['flour', 'liquid', 'fat', 'egg'].map((k) => [k, Math.round((tot[k] / base) * 100)]));
  // largest-remainder fix so the four shares always add up to 100
  const diff = 100 - Object.values(pct).reduce((a, b) => a + b, 0);
  if (diff) { const big = Object.keys(pct).sort((a, b) => pct[b] - pct[a])[0]; pct[big] += diff; }
  // soups/stews (flour only thickens) and deep-fried dishes (frying oil counted as fat) are not readable from a ratio
  if (pct.flour < 5 || pct.fat > 60) continue;
  const rkey = Object.values(pct).join(':');
  if (seenRatio.has(rkey)) continue; seenRatio.add(rkey); // identical ratios would be indistinguishable
  const words = m.strMeal.toLowerCase().split(/[^a-zà-ÿ]+/).filter((w) => w.length >= 4).map((w) => w.replace(/s$/, ''));
  const key = m.strMeal.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14);
  if (seen.has(key)) continue; seen.add(key);
  out.push({
    id: m.idMeal, name: m.strMeal, cat: m.strCategory, area: m.strArea || m.strCountry || '', img: m.strMealThumb,
    pct, sugarPct: Math.round((tot.sugar / base) * 100), grams: Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, Math.round(v)])),
    extra: [...new Set(extra)].filter((e) => !words.some((w) => e.toLowerCase().includes(w))).slice(0, 12), src: m.strSource || null,
  });
}
console.log(raw.length, '->', out.length);
fs.writeFileSync('../data.json', JSON.stringify({ dishes: out }));
console.log(out.slice(0, 8).map((d) => d.name + ' ' + JSON.stringify(d.pct)).join('\n'));
