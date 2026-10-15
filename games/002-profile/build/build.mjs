#!/usr/bin/env node
// Samples Copernicus GLO-90 elevation (via Open-Meteo elevation API) along 240 km transects with a
// random-looking (but deterministic) bearing, one 61-point profile per centre.
//   node build/build.mjs   (raw responses cached in build/raw/, git-ignored)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { destPoint } from '../game.js';
const here = new URL('.', import.meta.url);
const LEN_KM = 240, N = 61, MIN_RELIEF = 250;
const REG = {
  na: { name: '北美洲', bounds: [[6, -170], [74, -50]] },
  sa: { name: '南美洲', bounds: [[-57, -84], [14, -33]] },
  eu: { name: '欧洲', bounds: [[34, -26], [80, 46]] },
  af: { name: '非洲', bounds: [[-36, -20], [38, 53]] },
  as: { name: '亚洲', bounds: [[-11, 26], [56, 146]] },
  oc: { name: '大洋洲', bounds: [[-48, 110], [-1, 180]] },
};
// [lat, lng, region, place]
const C = [
  [27.98,86.9,'as','珠穆朗玛地区'],[36.5,-112.1,'na','大峡谷'],[46.55,8.0,'eu','伯尔尼阿尔卑斯'],[-13.5,-72,'sa','秘鲁安第斯'],
  [-3.07,37.35,'af','乞力马扎罗'],[63.6,-19.0,'eu','冰岛南部'],[44.4,-110.6,'na','黄石高原'],[37.7,-119.5,'na','内华达山脉'],
  [-33.4,-70,'sa','智利中部安第斯'],[-22,-68,'sa','阿塔卡马高原'],[35.9,76.5,'as','喀喇昆仑'],[30.5,91,'as','雅鲁藏布江谷地'],
  [42.5,0.5,'eu','比利牛斯'],[46,13,'eu','尤利安阿尔卑斯'],[47.5,-104,'na','北美大平原'],[40.2,-105.5,'na','科罗拉多落基山'],
  [-37,146.5,'oc','澳洲阿尔卑斯'],[-43.6,170.2,'oc','新西兰南阿尔卑斯'],[9.5,39.5,'af','埃塞俄比亚高原'],[13.2,38,'af','西门山地'],
  [-29.2,29.2,'af','德拉肯斯堡'],[31.5,-7,'af','高阿特拉斯'],[27,12.5,'af','撒哈拉'],[19.5,-155.6,'na','夏威夷岛'],
  [61,-150,'na','阿拉斯加山脉'],[60.5,7.5,'eu','挪威峡湾'],[42.7,44.3,'eu','高加索'],[39.1,70.5,'as','帕米尔'],
  [44,84,'as','准噶尔盆地'],[43,88,'as','天山'],[36,101,'as','青海高原'],[30.5,102.5,'as','横断山脉'],
  [28,84.5,'as','尼泊尔喜马拉雅'],[34,-5,'af','摩洛哥里夫'],[38.2,-3.5,'eu','伊比利亚内陆'],[37,25,'eu','爱琴海'],
  [47,25.5,'eu','喀尔巴阡'],[35.5,138.2,'as','日本阿尔卑斯'],[-8.2,-76,'sa','亚马逊西缘'],[-1.5,-78.3,'sa','厄瓜多尔火山带'],
  [4.8,-74,'sa','哥伦比亚安第斯'],[-17,-66,'sa','玻利维亚高原'],[-50.5,-73,'sa','巴塔哥尼亚冰原'],[-41.5,-71.5,'sa','巴塔哥尼亚北部'],
  [19.2,-99,'na','墨西哥火山带'],[36.4,-117.1,'na','死亡谷'],[40,-111.5,'na','瓦萨奇山脉'],[51.3,-116.5,'na','加拿大落基山'],
  [35.6,-83.5,'na','大烟山'],[67.5,-150,'na','布鲁克斯山脉'],[-25.3,131,'oc','澳洲中部'],[-31.5,138.6,'oc','弗林德斯山脉'],
  [-6.2,145,'oc','新几内亚高地'],[-8.3,116.4,'as','龙目岛'],[-7.9,110.2,'as','爪哇岛'],[28.6,-17.9,'af','加那利群岛'],
  [-19,46,'af','马达加斯加高地'],[3.5,38,'af','东非大裂谷'],[0,29.9,'af','鲁文佐里'],[-12.5,28,'af','赞比亚铜带'],
  [15.7,38.9,'af','红海沿岸'],[32,35.5,'as','约旦裂谷'],[38.5,45,'as','伊朗西北'],[35.9,52,'as','厄尔布尔士'],
  [27.8,87.5,'as','干城章嘉'],[46.2,99,'as','杭爱山'],[51,100.5,'as','萨彦岭'],[43.6,142.9,'as','北海道'],
  [-39.3,176,'oc','新西兰北岛'],[10,-84.2,'na','中美洲地峡'],
  [45.9,7.0,'eu','勃朗峰'],[43.2,-5.5,'eu','坎塔布连山脉'],[56.8,-4.5,'eu','苏格兰高地'],[47.2,11.3,'eu','蒂罗尔阿尔卑斯'],
  [42,13.8,'eu','亚平宁山脉'],[78.2,15.6,'eu','斯瓦尔巴'],[35.2,-106.3,'na','里奥格兰德裂谷'],[38.3,-122.5,'na','加州海岸山脉'],
  [58.5,-134.5,'na','阿拉斯加狭地'],[-23.5,-46.5,'sa','巴西海岸山脉'],[-14.5,-47.5,'sa','巴西高原'],[-34.7,-58.3,'sa','拉普拉塔河口'],
  [-34.3,-69.8,'sa','门多萨安第斯'],[-4.5,15.5,'af','刚果盆地'],[-23,17,'af','纳米比亚高原'],[-26,30,'af','南非高地'],
  [36.4,3.5,'af','阿特拉斯泰勒'],[33,131,'as','九州'],[27.1,100.2,'as','玉龙雪山'],[47.8,106.9,'as','蒙古草原'],
  [-23,119,'oc','皮尔巴拉'],[-33.8,150.5,'oc','悉尼盆地'],[-42,146.5,'oc','塔斯马尼亚'],[21,73.5,'as','西高止山脉'],
  [41,-2.5,'eu','伊比利亚山脉'],[52,-120,'na','不列颠哥伦比亚高原'],[-12,-75,'sa','安第斯东坡'],
];

/** Deterministic bearing (multiples of 15°) for centre i, so a rebuild reproduces data.json. */
const bearingFor = (i) => ((i * 7 + 5 * ((i * i) % 5) + 3) % 24) * 15;
const ends = (lat, lng, b) => ({ a: destPoint({ lat, lng }, (b + 180) % 360, LEN_KM / 2) });
let rateLimited = false; // after an hourly-limit 429, only cached profiles are used; re-run later to fill the rest
async function sample(lat, lng, bearing, k) {
  const cache = new URL(`raw/p${k}-${bearing}.json`, here);
  try { return JSON.parse(await readFile(cache, 'utf8')); } catch {}
  if (rateLimited) return null;
  const a = ends(lat, lng, bearing).a;
  const pts = Array.from({ length: N }, (_, i) => destPoint(a, bearing, (LEN_KM * i) / (N - 1)));
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p.lat.toFixed(4)).join(',')}&longitude=${pts.map((p) => p.lng.toFixed(4)).join(',')}`;
  for (let t = 0; t < 8; t++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
    console.log('fetch', k, r.status);
    if (r.ok) { const j = await r.json(); await writeFile(cache, JSON.stringify(j)); await new Promise((s) => setTimeout(s, 900)); return j; }
    if (r.status === 429) { rateLimited = true; console.log('rate limited; using cache only'); return null; }
    await new Promise((s) => setTimeout(s, 4000 * (t + 1)));
  }
  throw new Error('failed ' + k);
}
await mkdir(new URL('raw/', here), { recursive: true });
const puzzles = [];
for (let i = 0; i < C.length; i++) {
  const [lat, lng, region, place] = C[i];
  const bearing = bearingFor(i);
  const j = await sample(lat, lng, bearing, i);
  if (!j) { console.log('missing', place); continue; }
  const elev = j.elevation.map(Math.round);
  const relief = Math.max(...elev) - Math.min(...elev);
  if (elev.length !== N || !elev.every(Number.isFinite) || relief < MIN_RELIEF) { console.log('skip', place, relief); continue; }
  puzzles.push({ id: i, lat, lng, bearing, region, place, elev });
}
await writeFile(new URL('../data.json', here), JSON.stringify({ lenKm: LEN_KM, built: new Date().toISOString().slice(0, 10), regions: REG, puzzles }));
console.log(puzzles.length, 'puzzles');
