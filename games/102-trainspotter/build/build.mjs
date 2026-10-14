// Fetch geotagged Commons photos for a curated list of train types, write ../data.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(dir, 'raw');
fs.mkdirSync(raw, { recursive: true });
const UA = { 'User-Agent': 'DailyDataGames/1.0 (class project; lishuyustevenli@gmail.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// model facts curated by hand (operator = main operator whose trains are in the category)
const MODELS = [
  { id: 'class390', cat: 'British Rail Class 390', name: 'Class 390 Pendolino', op: 'Avanti West Coast', country: '英国' },
  { id: 'class800', cat: 'British Rail Class 800', name: 'Class 800 IET', op: 'GWR / LNER', country: '英国' },
  { id: 'tgvatl', cat: 'TGV Atlantique', name: 'TGV Atlantique', op: 'SNCF', country: '法国' },
  { id: 'tgvduplex', cat: 'TGV Duplex', name: 'TGV Duplex', op: 'SNCF', country: '法国' },
  { id: 'tgvreseau', cat: 'TGV Réseau', name: 'TGV Réseau', op: 'SNCF', country: '法国' },
  { id: 'railjet', cat: 'Railjet', name: 'Railjet', op: 'ÖBB', country: '奥地利' },
  { id: 'etr500', cat: 'ETR 500', name: 'ETR 500 Frecciarossa', op: 'Trenitalia', country: '意大利' },
  { id: 'fuxing', cat: 'Fuxing', name: 'CR 复兴号 Fuxing', op: '中国铁路 CR', country: '中国' },
  { id: 'ktx1', cat: 'KTX-I', name: 'KTX-I', op: 'Korail', country: '韩国' },
  { id: 'sapsan', cat: 'Sapsan', name: 'Siemens Velaro Sapsan', op: '俄罗斯铁路 RZD', country: '俄罗斯' },
  { id: 'giruno', cat: 'Giruno', name: 'SBB RABe 501 Giruno', op: 'SBB', country: '瑞士' },
  { id: 'ict', cat: 'ICE T', name: 'ICE T', op: 'Deutsche Bahn', country: '德国' },
  { id: 'eurostar', cat: 'Eurostar', name: 'Eurostar', op: 'Eurostar', country: '英法' },
  { id: 'acela', cat: 'Acela Express', name: 'Acela Express', op: 'Amtrak', country: '美国' },
  { id: 'cascades', cat: 'Amtrak Cascades', name: 'Talgo Cascades', op: 'Amtrak', country: '美国' },
  { id: 'e5', cat: 'Shinkansen E5', name: 'Shinkansen E5', op: 'JR East', country: '日本' },
  { id: 'e7', cat: 'Shinkansen E7', name: 'Shinkansen E7', op: 'JR East', country: '日本' },
  { id: 'thalys', cat: 'Thalys', name: 'Thalys PBKA', op: 'Thalys', country: '比利时/法国' },
];

async function api(params, cache) {
  const f = path.join(raw, cache + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ format: 'json', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  for (let i = 0; i < 5; i++) {
    const r = await fetch(u, { headers: UA });
    const t = await r.text();
    try { const j = JSON.parse(t); fs.writeFileSync(f, JSON.stringify(j)); await sleep(2500); return j; } catch { await sleep(15000); }
  }
  throw new Error('api failed ' + cache);
}
const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

const photos = [];
for (const m of MODELS) {
  const j = await api({ action: 'query', generator: 'search', gsrnamespace: 6, gsrsearch: `deepcategory:"${m.cat}" filetype:bitmap`, gsrlimit: 500, prop: 'coordinates', colimit: 'max' }, 'search-' + m.id);
  const geo = Object.values(j.query?.pages || {}).filter((p) => p.coordinates?.[0]).map((p) => ({ title: p.title, lat: p.coordinates[0].lat, lng: p.coordinates[0].lon }));
  geo.sort((a, b) => hash(a.title) - hash(b.title));
  const cand = geo.slice(0, 18);
  for (let i = 0; i < cand.length; i += 18) {
    const batch = cand.slice(i, i + 18);
    const r = await api({ action: 'query', titles: batch.map((b) => b.title).join('|'), prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: 640, iiextmetadatafilter: 'Artist|LicenseShortName|ImageDescription|DateTimeOriginal' }, `info-${m.id}-${i}`);
    const byT = Object.fromEntries(Object.values(r.query.pages).map((p) => [p.title, p]));
    for (const b of batch) {
      const ii = byT[b.title]?.imageinfo?.[0];
      if (!ii || ii.width < 1000 || ii.width < ii.height) continue;
      const md = ii.extmetadata || {};
      const lic = md.LicenseShortName?.value || '';
      if (!/CC|public|PD/i.test(lic)) continue;
      photos.push({
        id: m.id + '-' + photos.length, model: m.id, lat: +b.lat.toFixed(4), lng: +b.lng.toFixed(4),
        img: ii.thumburl.split('?')[0].replace('thumb.wikimedia.org', 'upload.wikimedia.org'), page: ii.descriptionurl, title: b.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
        author: strip(md.Artist?.value).replace(/ \(category\)/, '').slice(0, 60), lic: lic.slice(0, 24),
      });
    }
  }
  console.log(m.id, geo.length, photos.filter((p) => p.model === m.id).length);
}
// keep max 8 per model
const per = {}; const out = photos.filter((p) => (per[p.model] = (per[p.model] || 0) + 1) <= 8);
const data = { models: MODELS.map(({ cat, ...m }) => m), photos: out, fetched: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(dir, '..', 'data.json'), JSON.stringify(data));
console.log('photos', out.length, fs.statSync(path.join(dir, '..', 'data.json')).size);
