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
  { id: 'class390', cats: [['class390', 'British Rail Class 390']], name: 'Class 390 Pendolino', op: 'Avanti West Coast', country: '英国', family: 'uk390',
    tell: '白底、前端红紫色涂装的摆式列车（Pendolino），车头较圆钝，沿线是英国的 25 kV 架空接触网。' },
  { id: 'class800', cats: [['class800', 'British Rail Class 800']], name: 'Class 800 IET', op: 'GWR / LNER', country: '英国', family: 'uk800',
    tell: '日立 AT300 车头：侧面有发动机舱，GWR 为深绿色、LNER 为红白色。' },
  { id: 'tgvr', cats: [['tgvatl', 'TGV Atlantique'], ['tgvreseau', 'TGV Réseau']], name: 'TGV Atlantique / Réseau', op: 'SNCF', country: '法国', family: 'tgv',
    tell: '单层、尖鼻的铝灰/蓝色流线车头，车头上方有小窗；SNCF 的法国高铁，两个子型号外形几乎一样。' },
  { id: 'tgvduplex', cats: [['tgvduplex', 'TGV Duplex']], name: 'TGV Duplex', op: 'SNCF', country: '法国', family: 'tgv',
    tell: '车头与其他 TGV 相似，但车厢是双层的——看侧面窗户分上下两排。' },
  { id: 'railjet', cats: [['railjet', 'Railjet']], name: 'Railjet', op: 'ÖBB', country: '奥地利', family: 'railjet',
    tell: '白底配红灰色带的推挽式列车，车头尖而低，常见于奥地利和中欧的山区线路。' },
  { id: 'etr500', cats: [['etr500', 'ETR 500']], name: 'ETR 500 Frecciarossa', op: 'Trenitalia', country: '意大利', family: 'etr500',
    tell: '红灰涂装、细长鸭嘴状车头的 Frecciarossa（红箭），意大利 3 kV 直流接触网。' },
  { id: 'fuxing', cats: [['fuxing', 'Fuxing']], name: 'Fuxing 复兴号', op: 'China Railway (CR)', country: '中国', family: 'fuxing',
    tell: '白色车身配红/金色腰线，流线型车头很长，车身印有“CR”标志。' },
  { id: 'ktx1', cats: [['ktx1', 'KTX-I']], name: 'KTX-I', op: 'Korail', country: '韩国', family: 'ktx',
    tell: '源自 TGV 的尖鼻车头，银白车身配蓝红色带——韩国版 TGV。' },
  { id: 'sapsan', cats: [['sapsan', 'Sapsan']], name: 'Siemens Velaro Sapsan', op: 'RZD', country: '俄罗斯', family: 'velaro',
    tell: '西门子 Velaro 平滑的圆形车头，白灰车身配红色，俄式站台与宽轨线路。' },
  { id: 'giruno', cand: 54, cats: [['giruno', 'Giruno']], name: 'SBB Giruno', op: 'SBB', country: '瑞士', family: 'giruno',
    tell: '红底白色十字的 SBB 标志，车头高而平，带有圆润的下颌，穿行于阿尔卑斯山区。' },
  { id: 'ict', cats: [['ict', 'ICE T']], name: 'ICE T', op: 'Deutsche Bahn', country: '德国', family: 'ice',
    tell: '白色车身配红色腰带的摆式 ICE，车头为楔形、较钝，德国 15 kV 接触网。' },
  { id: 'eurostar', cats: [['eurostar373', 'British Rail Class 373s of Eurostar'], ['eurostar320', 'Eurostar e320']], name: 'Eurostar', op: 'Eurostar', country: '英法', family: 'eurostar',
    tell: '黄色鼻尖的银灰色车头、深蓝带，英吉利海峡隧道线路。' },
  { id: 'acela', cats: [['acela', 'Acela Express']], name: 'Acela Express', op: 'Amtrak', country: '美国', family: 'acela',
    tell: '银色车身配深蓝带，鼻子像鲨鱼头，东北走廊的美国式低站台与接触网。' },
  { id: 'e5', cats: [['e5', 'Shinkansen E5']], name: 'Shinkansen E5', op: 'JR East', country: '日本', family: 'e5',
    tell: '绿底银白、粉紫色腰线，车头鼻部极长（15 m），日本新干线高架线路。' },
  { id: 'e7', cats: [['e7', 'Shinkansen E7']], name: 'Shinkansen E7', op: 'JR East', country: '日本', family: 'e7',
    tell: '白色车身配铜色和蓝色腰线，车头鼻部比 E5 短一些。' },
  { id: 'thalys', cats: [['thalys', 'Thalys']], name: 'Thalys PBKA', op: 'Thalys', country: '比利时/法国', family: 'thalys',
    tell: '鲜红色涂装的流线车头，往来于巴黎、布鲁塞尔、阿姆斯特丹和科隆（2023 年起并入 Eurostar）。' },
  { id: 'thsr', cats: [['thsr', 'Taiwan High Speed 700T']], name: 'THSR 700T', op: 'THSR 台灣高鐵', country: '中国台湾', family: 'thsr',
    tell: '白底橘蓝腰线的新干线 700 系衍生车型，鼻锥扁长，沿线是台湾西部的高架高铁。' },
  { id: 'ave103', cats: [['ave103', 'Renfe Class 103']], name: 'Renfe AVE Class 103', op: 'Renfe', country: '西班牙', family: 'ave',
    tell: '西门子 Velaro E：白色车身配灰蓝色带、鸭嘴状车头，Renfe 的 AVE 高铁，常见于西班牙的高速新线。' },
];
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
const data = { models: MODELS.map(({ cats, cand, ...m }) => m), photos, fetched: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(dir, '..', 'data.json'), JSON.stringify(data));
fs.writeFileSync(path.join(raw, 'candidates.json'), JSON.stringify(allCands));
console.log('photos', photos.length, fs.statSync(path.join(dir, '..', 'data.json')).size);
