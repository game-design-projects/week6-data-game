// Step 3: Wikidata candidates (raw/wd.json) + PLUTO cross-check (raw/pluto.json) + Commons licence (raw/commons.json) -> ../data.json
// Run from build/:  node fetch-pluto.mjs && node build.mjs
// A building is kept only when a PLUTO lot within ~45 m has a yearbuilt within TOL years of the Wikidata inception year
// (two independent sources agree), the photo is a landscape/portrait JPEG >= 640 px with a Commons licence.
import fs from 'node:fs';
import { candidates } from './lib.mjs';
const UA = 'daily-data-games/1.0 (NYU class project)';
export const TOL = 3;
const BORO = { MN: '曼哈顿', BK: '布鲁克林', QN: '皇后区', BX: '布朗克斯', SI: '史坦顿岛' };

export function matchPluto(b, lots) {
  const near = (lots || []).map((l) => ({ ...l, py: +l.yearbuilt, d: Math.hypot((+l.latitude - b.lat) * 111, (+l.longitude - b.lng) * 84) }))
    .filter((l) => l.py > 0 && Math.abs(l.py - b.year) <= TOL).sort((a, c) => a.d - c.d);
  return near[0] || null;
}

const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim().slice(0, 60);

async function main() {
  const pluto = JSON.parse(fs.readFileSync('raw/pluto.json'));
  const pool = [];
  for (const b of candidates()) {
    const l = matchPluto(b, pluto[b.id]);
    if (l) pool.push({ ...b, lot: l });
  }
  console.log('candidates', candidates().length, 'pluto-confirmed', pool.length);

  const cache = 'raw/commons.json';
  const meta = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache)) : {};
  const key = (f) => f.replace(/ /g, '_');
  const need = pool.filter((b) => !(key(b.file) in meta));
  for (let i = 0; i < need.length; i += 40) {
    const titles = need.slice(i, i + 40).map((b) => 'File:' + b.file).join('|');
    const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'extmetadata|size', titles });
    let j = null;
    for (let t = 0; t < 6 && !j; t++) {
      try { j = await (await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json(); }
      catch { console.warn('commons rate-limited, backing off'); await new Promise((r) => setTimeout(r, 15000 * (t + 1))); }
    }
    if (!j) throw new Error('commons unreachable');
    const norm = Object.fromEntries((j.query.normalized || []).map((n) => [n.to, n.from]));
    for (const p of Object.values(j.query.pages)) meta[key((norm[p.title] || p.title).replace(/^File:/, ''))] = p.imageinfo?.[0] || null;
    console.log('commons', i, '/', need.length);
    fs.writeFileSync(cache, JSON.stringify(meta));
    await new Promise((r) => setTimeout(r, 3000));
  }
  fs.writeFileSync(cache, JSON.stringify(meta));

  const items = []; const seenFile = new Set();
  for (const b of pool) {
    const mi = meta[key(b.file)];
    if (!mi || mi.width < 640 || mi.height / mi.width > 1.6 || mi.width / mi.height > 2.2) continue;
    const e = mi.extmetadata || {};
    const lic = e.LicenseShortName?.value;
    if (!lic || /fair use|non-free/i.test(lic) || seenFile.has(key(b.file))) continue;
    seenFile.add(key(b.file));
    const l = b.lot;
    items.push({
      id: b.id, name: b.name, year: b.year, boro: BORO[l.borough] || '', file: b.file,
      author: strip(e.Artist?.value) || 'Wikimedia Commons', lic,
      addr: (l.address || '').replace(/\s+/g, ' ').trim(), fl: Math.round(+l.numfloors) || 0, cls: l.bldgclass || '', py: l.py,
    });
  }
  items.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  fs.writeFileSync('../data.json', JSON.stringify({ items }));
  console.log(items.length, 'items,', fs.statSync('../data.json').size, 'bytes');
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
