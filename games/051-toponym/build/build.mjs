// Fetch Wikidata coordinates for each curated toponym (cached in raw/), write ../data.json
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { PLACES } from './places.mjs';
import { LANG_NOTES } from './langnotes.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url)); const raw = path.join(dir, 'raw'); fs.mkdirSync(raw, { recursive: true });
const UA = 'daily-data-games/1.0 (class project; lishuyustevenli@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cached(name, url) {
  const f = path.join(raw, name.replace(/[^\w.-]/g, '_') + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  await sleep(400);
  const r = await fetch(url, { headers: { 'User-Agent': UA } }); const t = await r.text(); fs.writeFileSync(f, t);
  return JSON.parse(t);
}
const OV = { Oxford: 'Q34217', Chicago: 'Q1297', 'Buenos Aires': 'Q1486', Ottawa: 'Q1930', Riyadh: 'Q3692', Netherlands: 'Q55', Montenegro: 'Q236', Florence: 'Q2044', 'Puerto Rico': 'Q1183', Mesopotamia: 'Q11767', Kosovo: 'Q1246' };
const out = []; const report = [];
for (const [q, kw, name, orig, lang, meaning, kind] of PLACES) {
  const s = await cached('s_' + q, `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&limit=8&format=json`);
  const ids = OV[q] ? [OV[q]] : (s.search || []).map((x) => x.id);
  const e = await cached((OV[q] ? 'o_' : 'e_') + q, `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=claims|sitelinks|descriptions|labels&sitefilter=enwiki&languages=en&format=json`);
  let pick = null;
  for (const id of ids) {
    const en = e.entities?.[id]; const c = en?.claims?.P625?.[0]?.mainsnak?.datavalue?.value; if (!c) continue;
    const d = (en.descriptions?.en?.value || '') + ' ' + (en.labels?.en?.value || '');
    if (!OV[q] && (en.labels?.en?.value || '').toLowerCase() !== q.toLowerCase() && !(s.search.find((x) => x.id === id)?.match?.text || '').toLowerCase().startsWith(q.toLowerCase())) continue;
    if (!OV[q] && !d.toLowerCase().includes(kw.toLowerCase()) && !new RegExp(kw.split(' ')[0], 'i').test(d)) { report.push(`? ${q}: ${id} ${d}`); continue; }
    pick = { id, lat: +c.latitude.toFixed(3), lng: +c.longitude.toFixed(3), wiki: en.sitelinks?.enwiki?.title, desc: en.descriptions?.en?.value }; break;
  }
  if (!pick) { report.push(`MISSING ${q}`); continue; }
  out.push({ id: pick.id, name, orig, lang, meaning, kind, lat: pick.lat, lng: pick.lng, wiki: pick.wiki });
  report.push(`ok ${q} -> ${pick.id} ${pick.desc} ${pick.lat},${pick.lng}`);
}
console.log(report.join('\n'));
fs.writeFileSync(path.join(dir, '..', 'data.json'), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), places: out, langNotes: Object.fromEntries([...new Set(out.map((p) => p.lang))].map((l) => [l, LANG_NOTES[l]])) }));
console.log(out.length, 'places');
