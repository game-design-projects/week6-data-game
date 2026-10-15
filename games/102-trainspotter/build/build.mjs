// Fetch geotagged Commons photos for a curated list of train types, write ../data.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(dir, 'raw');
fs.mkdirSync(raw, { recursive: true });
const UA = { 'User-Agent': 'DailyDataGames/1.0 (class project; lishuyustevenli@gmail.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// model facts curated by hand (operator = main operator whose trains are in the category).
// `family`: models that look alike are never offered together as choices; `tell`: what gives the type away.
const MODELS = [
  { id: 'class390', cats: [['class390', 'British Rail Class 390']], name: 'Class 390 Pendolino', op: 'Avanti West Coast', country: 'UK', family: 'uk390',
    tell: 'A white tilting train (Pendolino) with a red-purple front end and a rounded, blunt nose, running under the UK\'s 25 kV overhead wires.' },
  { id: 'class800', cats: [['class800', 'British Rail Class 800']], name: 'Class 800 IET', op: 'GWR / LNER', country: 'UK', family: 'uk800',
    tell: 'Hitachi AT300 nose with engine pods along the sides: dark green for GWR, red and white for LNER.' },
  { id: 'tgvr', cats: [['tgvatl', 'TGV Atlantique'], ['tgvreseau', 'TGV Réseau']], name: 'TGV Atlantique / Réseau', op: 'SNCF', country: 'France', family: 'tgv',
    tell: 'Single-deck, pointed aluminum-gray and blue streamlined nose with a small window above it; SNCF\'s French high-speed train, and the two sub-types look almost identical.' },
  { id: 'tgvduplex', cats: [['tgvduplex', 'TGV Duplex']], name: 'TGV Duplex', op: 'SNCF', country: 'France', family: 'tgv',
    tell: 'Nose similar to other TGVs, but the cars are double-deck: look for two rows of windows on the side.' },
  { id: 'railjet', cats: [['railjet', 'Railjet']], name: 'Railjet', op: 'ÖBB', country: 'Austria', family: 'railjet',
    tell: 'A push-pull train in white with a red and gray stripe and a low, pointed nose, common in Austria and the mountains of central Europe.' },
  { id: 'etr500', cats: [['etr500', 'ETR 500']], name: 'ETR 500 Frecciarossa', op: 'Trenitalia', country: 'Italy', family: 'etr500',
    tell: 'Frecciarossa (Red Arrow) in red and gray with a long, slim duckbill nose, under Italy\'s 3 kV DC wires.' },
  { id: 'fuxing', cats: [['fuxing', 'Fuxing']], name: 'Fuxing (CR400)', op: 'China Railway (CR)', country: 'China', family: 'fuxing',
    tell: 'White body with a red or gold waistline, a very long streamlined nose and a "CR" logo on the side.' },
  { id: 'ktx1', cats: [['ktx1', 'KTX-I']], name: 'KTX-I', op: 'Korail', country: 'South Korea', family: 'ktx',
    tell: 'A TGV derivative with a pointed nose and a silver-white body with blue and red bands: Korea\'s take on the TGV.' },
  { id: 'sapsan', cats: [['sapsan', 'Sapsan']], name: 'Siemens Velaro Sapsan', op: 'RZD', country: 'Russia', family: 'velaro',
    tell: 'Siemens Velaro\'s smooth rounded nose in white and gray with red, on Russian platforms and broad-gauge track.' },
  { id: 'giruno', cand: 54, cats: [['giruno', 'Giruno']], name: 'SBB Giruno', op: 'SBB', country: 'Switzerland', family: 'giruno',
    tell: 'The SBB white cross on a red square, a tall flat front with a rounded chin, threading through the Alps.' },
  { id: 'ict', cats: [['ict', 'ICE T']], name: 'ICE T', op: 'Deutsche Bahn', country: 'Germany', family: 'ice',
    tell: 'A tilting ICE in white with a red band and a blunt, wedge-shaped nose, under Germany\'s 15 kV wires.' },
  { id: 'eurostar', cats: [['eurostar373', 'British Rail Class 373s of Eurostar'], ['eurostar320', 'Eurostar e320']], name: 'Eurostar', op: 'Eurostar', country: 'UK/France', family: 'eurostar',
    tell: 'Silver-gray nose with a yellow tip and a dark blue band, on the Channel Tunnel route.' },
  { id: 'acela', cats: [['acela', 'Acela Express']], name: 'Acela Express', op: 'Amtrak', country: 'USA', family: 'acela',
    tell: 'Silver body with a dark blue band and a shark-like nose, on the low platforms and catenary of the Northeast Corridor.' },
  { id: 'e5', cats: [['e5', 'Shinkansen E5']], name: 'Shinkansen E5', op: 'JR East', country: 'Japan', family: 'e5',
    tell: 'Green and silver-white with a pink-purple stripe and a very long nose (15 m), on Japan\'s elevated Shinkansen lines.' },
  { id: 'e7', cats: [['e7', 'Shinkansen E7']], name: 'Shinkansen E7', op: 'JR East', country: 'Japan', family: 'e7',
    tell: 'White body with copper and blue stripes; the nose is shorter than the E5\'s.' },
  { id: 'thalys', cats: [['thalys', 'Thalys']], name: 'Thalys PBKA', op: 'Thalys', country: 'Belgium/France', family: 'thalys',
    tell: 'A bright red streamlined nose, running between Paris, Brussels, Amsterdam and Cologne (merged into Eurostar in 2023).' },
  { id: 'thsr', cats: [['thsr', 'Taiwan High Speed 700T']], name: 'THSR 700T', op: 'THSR (Taiwan High Speed Rail)', country: 'Taiwan', family: 'thsr',
    tell: 'A white train with orange and blue stripes, derived from the Shinkansen 700 series, with a flat, long nose, on Taiwan\'s elevated west-coast high-speed line.' },
  { id: 'ave103', cats: [['ave103', 'Renfe Class 103']], name: 'Renfe AVE Class 103', op: 'Renfe', country: 'Spain', family: 'ave',
    tell: 'Siemens Velaro E: white body with gray-blue bands and a duckbill nose, Renfe\'s AVE high-speed train on Spain\'s new high-speed lines.' },
];
// Display titles / author names for Commons files whose own title or author is in CJK script (keys are escaped so this file stays ASCII).
const TITLE_EN = {
  '\u4fdd\u5b9a\u4e1c\u7ad9 - G54\u6b21\u5217\u8f66\u8fdb\u7ad9 - 2025-10-25': "Train G54 arriving at Baoding East station - 2025-10-25",
  '\u843d\u65e5\u4e0b\u7684CR200J\u8fdb\u5165\u897f\u5b89\u7ad9': "CR200J entering Xi'an station at sunset",
  '\u65b0\u9752\u68ee\u99c5 - panoramio (8)': "Shin-Aomori Station - panoramio (8)",
  'E5 Serise Shinkansen , E5\u7cfb \u65b0\u5e79\u7dda - panoramio (4)': "E5 Serise Shinkansen - panoramio (4)",
  '\u65b0\u9752\u68ee\u99c5 - panoramio (11)': "Shin-Aomori Station - panoramio (11)",
  '\u4ed9\u53f0\u99c5 - panoramio (4)': "Sendai Station - panoramio (4)",
  '\u65b0\u9752\u68ee\u99c5 - panoramio (13)': "Shin-Aomori Station - panoramio (13)",
  '\u65b0\u5e79\u7ddaE5\u7cfb - \u6771\u4eac\u99c5 - panoramio': "Shinkansen E5 series - Tokyo Station - panoramio",
  '\u6771\u4eac\u99c5 - panoramio (45)': "Tokyo Station - panoramio (45)",
  '\u9ad8\u96c4\u5e02\u5de6\u71df\u5340 \u9ad8\u9435\u9ad8\u96c4\u7ad9 \u9ad8\u9435\u5217\u8eca - panoramio (1)': "Zuoying District, Kaohsiung - THSR Kaohsiung station - THSR train - panoramio (1)",
  'Zuoying Station-Taiwan High Speed Rail \u9ad8\u9435\u5de6\u71df\u7ad9 - panoramio': "Zuoying Station-Taiwan High Speed Rail - panoramio",
};
const PER_MODEL = 14;
// approved.json = titles of candidates that passed a manual look at the photo (no legible operator logo or place sign,
// train clearly visible, right model, not an interior). Without it, every candidate is kept (used to make review sheets).
const APPROVED = fs.existsSync(path.join(dir, 'approved.json')) ? new Set(JSON.parse(fs.readFileSync(path.join(dir, 'approved.json'), 'utf8'))) : null;
const BAD_TITLE = /interior|\bcab\b|seat|diagram|logo|model|toy|lego|drawing|\bmap\b|plan\b|poster|ticket|timetable|nameplate|sign\b|driver|bogie|pantograph|depot|museum/i;

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
const allCands = [];
for (const m of MODELS) {
  let geo = [];
  for (const [cid, cat] of m.cats) {
    const j = await api({ action: 'query', generator: 'search', gsrnamespace: 6, gsrsearch: `deepcategory:"${cat}" filetype:bitmap`, gsrlimit: 500, prop: 'coordinates', colimit: 'max' }, 'search-' + cid);
    geo.push(...Object.values(j.query?.pages || {}).filter((p) => p.coordinates?.[0]).map((p) => ({ title: p.title, lat: p.coordinates[0].lat, lng: p.coordinates[0].lon })));
  }
  geo = geo.filter((g, i) => !BAD_TITLE.test(g.title) && geo.findIndex((x) => x.title === g.title) === i);
  geo.sort((a, b) => hash(a.title) - hash(b.title));
  const cand = geo.slice(0, m.cand || 36);
  const got = [];
  for (let i = 0; i < cand.length; i += 18) {
    const batch = cand.slice(i, i + 18);
    const r = await api({ action: 'query', titles: batch.map((b) => b.title).join('|'), prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: 960, iiextmetadatafilter: 'Artist|LicenseShortName' }, `info-${m.cats.length > 1 ? m.id + '2' : m.id}-${i}`);
    const byT = Object.fromEntries(Object.values(r.query.pages).map((p) => [p.title, p]));
    for (const b of batch) {
      const ii = byT[b.title]?.imageinfo?.[0];
      if (!ii || ii.width < 1000 || ii.width < ii.height * 1.2) continue;
      const md = ii.extmetadata || {};
      const lic = md.LicenseShortName?.value || '';
      if (!/CC|public|PD/i.test(lic) || /NC|ND/.test(lic)) continue;
      if (!ii.thumburl || !/^https:\/\/upload\.wikimedia\.org\//.test(ii.thumburl.replace('thumb.wikimedia.org', 'upload.wikimedia.org'))) continue;
      got.push({
        id: m.id + '-' + got.length, model: m.id, lat: +b.lat.toFixed(4), lng: +b.lng.toFixed(4),
        img: ii.thumburl.split('?')[0].replace('thumb.wikimedia.org', 'upload.wikimedia.org'), page: ii.descriptionurl, title: b.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
        author: strip(md.Artist?.value).replace(/ \(category\)/, '').replace(/\s*\(https?:[^)]*\)/g, '').slice(0, 80) || 'unknown', lic: lic.slice(0, 24),
      });
    }
  }
  allCands.push(...got);
  photos.push(...got.filter((g) => !APPROVED || APPROVED.has(g.title)).slice(0, PER_MODEL));
  console.log(m.id, geo.length, got.length);
}
// a file filed under two different models is ambiguous: drop it everywhere
const seenModel = new Map();
for (const c of allCands) seenModel.set(c.title, new Set([...(seenModel.get(c.title) || []), c.model]));
for (let i = photos.length - 1; i >= 0; i--) if (seenModel.get(photos[i].title).size > 1) photos.splice(i, 1);
for (const p of photos) { p.title = TITLE_EN[p.title] ?? p.title; }
const data = { models: MODELS.map(({ cats, cand, ...m }) => m), photos, fetched: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(dir, '..', 'data.json'), JSON.stringify(data));
fs.writeFileSync(path.join(raw, 'candidates.json'), JSON.stringify(allCands));
console.log('photos', photos.length, fs.statSync(path.join(dir, '..', 'data.json')).size);
