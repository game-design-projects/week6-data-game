// Fetch iNaturalist species lists + weekly-of-year histograms into build/raw/ (cached, 2 requests in flight).
import fs from 'node:fs'; import path from 'node:path';
const RAW = new URL('./raw/', import.meta.url).pathname;
const UA = { 'User-Agent': 'daily-data-games/1.0 (NYU class project; phenology game)' };
const PLACES = { US: 1, CA: 6712, GB: 6857, AU: 6744, NZ: 6803 };
const GROUPS = ['Aves', 'Insecta', 'Plantae', 'Fungi', 'Reptilia', 'Amphibia', 'Mammalia'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(RAW, { recursive: true });
async function cached(name, url) {
  const f = path.join(RAW, name);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let i = 0; i < 4; i++) {
    let r; try { r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) }); } catch (e) { console.error('err', name, e.cause?.code || e.name); await sleep(5000); continue; }
    if (r.ok) { const t = await r.text(); fs.writeFileSync(f, t); await sleep(1200); return JSON.parse(t); }
    console.error('retry', r.status, url); await sleep(4000 * (i + 1));
  }
  console.error('gave up', name); return null;
}
const base = 'https://api.inaturalist.org/v1/observations';
const lists = {};
for (const [cc, pid] of Object.entries(PLACES)) for (const g of GROUPS) {
  const j = await cached(`sp_${cc}_${g}.json`, `${base}/species_counts?place_id=${pid}&iconic_taxa=${g}&per_page=200&quality_grade=research&locale=zh-CN`);
  lists[`${cc}_${g}`] = j.results.map((x) => ({ id: x.taxon.id, count: x.count }));
}
for (const [cc, pid] of Object.entries(PLACES)) for (const g of GROUPS)
  await cached(`tot_${cc}_${g}.json`, `${base}/histogram?iconic_taxa=${g}&place_id=${pid}&date_field=observed&interval=week_of_year&quality_grade=research`);
const seen = new Map();
for (const [k, arr] of Object.entries(lists)) { const cc = k.split('_')[0]; for (const x of arr) if (x.count >= 300) { if (!seen.has(x.id)) seen.set(x.id, new Set()); seen.get(x.id).add(cc); } }
const tot = new Map(); for (const arr of Object.values(lists)) for (const x of arr) tot.set(x.id, (tot.get(x.id) || 0) + x.count);
const cand = [...seen].filter(([, s]) => s.size >= 2).map(([id]) => id).sort((a, b) => tot.get(b) - tot.get(a)).slice(0, 230);
console.log('candidates', cand.length);
const jobs = cand.flatMap((id) => Object.entries(PLACES).map(([cc, pid]) => [`h_${id}_${cc}.json`, `${base}/histogram?taxon_id=${id}&place_id=${pid}&date_field=observed&interval=week_of_year&quality_grade=research`]));
let next = 0, done = 0;
await Promise.all(Array.from({ length: 2 }, async () => { while (next < jobs.length) { const j = jobs[next++]; await cached(...j); if (++done % 50 === 0) console.log('done', done, '/', jobs.length); } }));
console.log('finished');
