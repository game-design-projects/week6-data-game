// Fetch IEM NEXRAD n0r composite PNGs (derived from NOAA radar), crop storm windows, emit data.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, toPuzzle, TIERS, W, H } from '../shape.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(dir, 'raw');
fs.mkdirSync(raw, { recursive: true });
const UA = 'daily-data-games class project (lishuyustevenli@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(date, hh) {
  const [y, m, d] = date.split('-');
  const name = `n0r_${y}${m}${d}${hh}00.png`;
  const f = path.join(raw, name);
  if (!fs.existsSync(f)) {
    const r = await fetch(`https://mesonet.agron.iastate.edu/archive/data/${y}/${m}/${d}/GIS/uscomp/${name}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    await sleep(400);
  }
  return decodePNG(fs.readFileSync(f));
}

// deterministic candidate dates (convective season, 2022-2025)
let s = 92;
const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const cands = [];
for (let i = 0; i < 260; i++) {
  const y = 2022 + Math.floor(rnd() * 4), m = 4 + Math.floor(rnd() * 5), d = 1 + Math.floor(rnd() * 28);
  cands.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
}
const uniq = [...new Set(cands)].sort();
const puzzles = [];
for (const date of uniq) {
  if (puzzles.length >= 80) break;
  const hh = ['20', '21', '22', '23', '00'][Math.floor(rnd() * 5)];
  const img = await get(date, hh).catch(() => null);
  if (!img || img.w !== 6000) continue;
  const p = toPuzzle(img, date, hh, { tier: TIERS[0] });
  if (!p) { console.log('skip', date, hh); continue; }
  delete p._sc;
  puzzles.push(p);
  console.log(puzzles.length, date, hh);
}
fs.writeFileSync(path.join(dir, '..', 'data.json'), JSON.stringify({ w: W, h: H, puzzles }));
console.log('wrote', puzzles.length);
