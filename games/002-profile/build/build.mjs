#!/usr/bin/env node
// Samples Copernicus GLO-90 elevation (via Open-Meteo elevation API) along W→E transects.
//   node build/build.mjs   (raw responses cached in build/raw/)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const here = new URL('.', import.meta.url);
const LEN_KM = 240, N = 81;
const REG = {
  na: { name: '北美洲', center: [40, -105], zoom: 3 },
  sa: { name: '南美洲', center: [-15, -65], zoom: 3 },
  eu: { name: '欧洲', center: [48, 12], zoom: 4 },
  af: { name: '非洲', center: [2, 20], zoom: 3 },
  as: { name: '亚洲', center: [35, 85], zoom: 3 },
  oc: { name: '大洋洲', center: [-30, 150], zoom: 3 },
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
];
async function sample(lat, lng, k) {
  const cache = new URL(`raw/t${k}.json`, here);
  try { return JSON.parse(await readFile(cache, 'utf8')); } catch {}
  const dLng = LEN_KM / (111.32 * Math.cos(lat * Math.PI / 180));
  const lngs = Array.from({ length: N }, (_, i) => lng - dLng / 2 + (dLng * i) / (N - 1));
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${Array(N).fill(lat).join(',')}&longitude=${lngs.map((x) => x.toFixed(4)).join(',')}`;
  for (let t = 0; t < 5; t++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
    if (r.ok) { const j = await r.json(); await writeFile(cache, JSON.stringify(j)); await new Promise((s) => setTimeout(s, 700)); return j; }
    await new Promise((s) => setTimeout(s, 5000 * (t + 1)));
  }
  throw new Error('failed ' + k);
}
await mkdir(new URL('raw/', here), { recursive: true });
const puzzles = [];
for (let i = 0; i < C.length; i++) {
  const [lat, lng, reg, place] = C[i];
  const j = await sample(lat, lng, i);
  const el = j.elevation.map(Math.round);
  puzzles.push({ id: i, lat, lng, region: reg, place, elev: el });
}
await writeFile(new URL('../data.json', here), JSON.stringify({ lenKm: LEN_KM, built: new Date().toISOString().slice(0, 10), regions: REG, puzzles }));
console.log(puzzles.length, 'puzzles');
