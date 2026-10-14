// 1) Census Gazetteer (tract centroids). 2) pick ~220 candidate tracts (seeded, capped per state).
// 3) fetch ACS 5-year (2020-2024) tables for them via Census Reporter (the Census API itself now demands a key).
import fs from 'node:fs'; import { execSync } from 'node:child_process';
const raw = new URL('./raw/', import.meta.url).pathname;
if (!fs.readdirSync(raw).some((f) => /Gaz_tracts.*\.txt$/.test(f))) execSync(`cd ${raw} && unzip -o -q gaz.zip`);
const gaz = fs.readdirSync(raw).find((f) => /Gaz_tracts.*\.txt$/.test(f));
const all = fs.readFileSync(raw + gaz, 'utf8').split('\n').slice(1).map((l) => l.split('\t').map((x) => x.trim())).filter((c) => c.length >= 8 && +c[4] < 40 && +c[4] > 0.05);
let s = 63; const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
const cnt = {}; const cand = [];
for (const c of all) { cnt[c[0]] = (cnt[c[0]] || 0) + 1; if (cnt[c[0]] <= (['CA', 'TX', 'NY', 'FL'].includes(c[0]) ? 9 : 5)) cand.push(c); }
console.log('candidates', cand.length);
const T = 'B01003,B19013,B25064,B25077,B01002,B08301,B25044,B15003,B25003,B03002,B05002,B25035,B17001,B25024';
fs.writeFileSync(raw + 'cand.json', JSON.stringify(cand.map((c) => ({ st: c[0], id: c[1], lat: +c[6], lng: +c[7] }))));
for (let i = 0; i < cand.length; i += 8) {
  const f = `${raw}cr_${i}.json`; if (fs.existsSync(f)) continue;
  const ids = cand.slice(i, i + 8).map((c) => '14000US' + c[1]).join(',');
  const r = await fetch(`https://api.censusreporter.org/1.0/data/show/latest?table_ids=${T}&geo_ids=${ids}`, { headers: { 'User-Agent': 'daily-data-games class project' } });
  if (!r.ok) { console.error(i, r.status); continue; }
  fs.writeFileSync(f, await r.text()); process.stdout.write('.'); await new Promise((r) => setTimeout(r, 500));
}
