// raw/candidates.json -> ../data.json   (run: cd build && node build.mjs)
// Commons categories ("<type> of <operator> at <airport>") are volunteer-maintained and sometimes wrong,
// so every candidate is cross-checked against its own file title / description before it is kept.
import { readFileSync, writeFileSync } from 'node:fs';
import { AIRPORTS } from './airports.mjs';
import { normType, normOp, plausible, parseDate } from './clean.mjs';

const cands = JSON.parse(readFileSync('raw/candidates.json', 'utf8'));
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const allOps = [...new Set(cands.map((c) => normOp(c.operator)))];

const photos = [];
const seen = new Set();
const drop = {};
const why = (r) => { drop[r] = (drop[r] || 0) + 1; };
for (const c of cands) {
  if (!c.thumb || !c.date || !c.w || c.w < 800) { why('no thumb/date/small'); continue; }
  if (c.h > c.w * 1.05) { why('portrait'); continue; }
  const date = parseDate(c.date);
  if (!date || +date.slice(0, 4) < 1975 || date > '2026-10-15') { why('date'); continue; }
  const op = normOp(c.operator);
  const type = normType(c.type);
  if (!op || op.length > 40 || type.length > 40) { why('long'); continue; }
  const title = c.file.replace(/^File:/, '').replace(/\.\w+$/, '');
  const verdict = plausible({ title, desc: strip(c.desc), op, type, allOps });
  if (verdict !== 'ok') { why(verdict); continue; }
  if (seen.has(c.file)) { why('dup'); continue; }
  seen.add(c.file);
  // thumb: drop tracking query to keep data small
  const thumb = c.thumb.replace(/\?utm_.*$/, '');
  photos.push({ iata: c.iata, type, op, thumb, page: c.page, date, by: strip(c.artist).slice(0, 60) || 'Wikimedia Commons', lic: c.license || 'CC' });
}
const n = {}; photos.forEach((p) => (n[p.iata] = (n[p.iata] || 0) + 1));
const out = {
  airports: AIRPORTS.filter((a) => n[a[0]]).map(([iata, en, name, country, cont, lat, lng]) => ({ iata, en, name, country, cont, lat, lng })),
  photos,
};
writeFileSync('../data.json', JSON.stringify(out));
console.log('dropped', JSON.stringify(drop));
console.log(out.airports.length, 'airports', out.photos.length, 'photos', JSON.stringify(out).length, 'bytes');
