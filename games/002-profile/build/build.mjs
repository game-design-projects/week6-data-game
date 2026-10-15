#!/usr/bin/env node
// Samples Copernicus GLO-90 elevation (via Open-Meteo elevation API) along 240 km transects with a
// random-looking (but deterministic) bearing, one 61-point profile per centre.
//   node build/build.mjs   (raw responses cached in build/raw/, git-ignored)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { destPoint } from '../game.js';
const here = new URL('.', import.meta.url);
const LEN_KM = 240, N = 61, MIN_RELIEF = 250;
const REG = {
  na: { name: 'North America', bounds: [[6, -170], [74, -50]] },
  sa: { name: 'South America', bounds: [[-57, -84], [14, -33]] },
  eu: { name: 'Europe', bounds: [[34, -26], [80, 46]] },
  af: { name: 'Africa', bounds: [[-36, -20], [38, 53]] },
  as: { name: 'Asia', bounds: [[-11, 26], [56, 146]] },
  oc: { name: 'Oceania', bounds: [[-48, 110], [-1, 180]] },
};
// [lat, lng, region, place]
const C = [
  [27.98,86.9,'as','Everest region'],[36.5,-112.1,'na','Grand Canyon'],[46.55,8.0,'eu','Bernese Alps'],[-13.5,-72,'sa','Peruvian Andes'],
  [-3.07,37.35,'af','Kilimanjaro'],[63.6,-19.0,'eu','Southern Iceland'],[44.4,-110.6,'na','Yellowstone Plateau'],[37.7,-119.5,'na','Sierra Nevada'],
  [-33.4,-70,'sa','Central Chilean Andes'],[-22,-68,'sa','Atacama Plateau'],[35.9,76.5,'as','Karakoram'],[30.5,91,'as','Yarlung Tsangpo valley'],
  [42.5,0.5,'eu','Pyrenees'],[46,13,'eu','Julian Alps'],[47.5,-104,'na','Great Plains'],[40.2,-105.5,'na','Colorado Rockies'],
  [-37,146.5,'oc','Australian Alps'],[-43.6,170.2,'oc','Southern Alps, NZ'],[9.5,39.5,'af','Ethiopian Highlands'],[13.2,38,'af','Simien Mountains'],
  [-29.2,29.2,'af','Drakensberg'],[31.5,-7,'af','High Atlas'],[27,12.5,'af','Sahara'],[19.5,-155.6,'na','Big Island of Hawaii'],
  [61,-150,'na','Alaska Range'],[60.5,7.5,'eu','Norwegian fjords'],[42.7,44.3,'eu','Caucasus'],[39.1,70.5,'as','Pamir'],
  [44,84,'as','Junggar Basin'],[43,88,'as','Tian Shan'],[36,101,'as','Qinghai Plateau'],[30.5,102.5,'as','Hengduan Mountains'],
  [28,84.5,'as','Nepal Himalaya'],[34,-5,'af','Moroccan Rif'],[38.2,-3.5,'eu','Iberian interior'],[37,25,'eu','Aegean Sea'],
  [47,25.5,'eu','Carpathians'],[35.5,138.2,'as','Japanese Alps'],[-8.2,-76,'sa','Western Amazon'],[-1.5,-78.3,'sa','Ecuador volcanic belt'],
  [4.8,-74,'sa','Colombian Andes'],[-17,-66,'sa','Bolivian Altiplano'],[-50.5,-73,'sa','Patagonian Ice Field'],[-41.5,-71.5,'sa','Northern Patagonia'],
  [19.2,-99,'na','Mexican volcanic belt'],[36.4,-117.1,'na','Death Valley'],[40,-111.5,'na','Wasatch Range'],[51.3,-116.5,'na','Canadian Rockies'],
  [35.6,-83.5,'na','Great Smoky Mountains'],[67.5,-150,'na','Brooks Range'],[-25.3,131,'oc','Central Australia'],[-31.5,138.6,'oc','Flinders Ranges'],
  [-6.2,145,'oc','New Guinea Highlands'],[-8.3,116.4,'as','Lombok'],[-7.9,110.2,'as','Java'],[28.6,-17.9,'af','Canary Islands'],
  [-19,46,'af','Madagascar Highlands'],[3.5,38,'af','East African Rift'],[0,29.9,'af','Rwenzori'],[-12.5,28,'af','Zambian Copperbelt'],
  [15.7,38.9,'af','Red Sea coast'],[32,35.5,'as','Jordan Rift Valley'],[38.5,45,'as','Northwest Iran'],[35.9,52,'as','Alborz'],
  [27.8,87.5,'as','Kangchenjunga'],[46.2,99,'as','Khangai Mountains'],[51,100.5,'as','Sayan Mountains'],[43.6,142.9,'as','Hokkaido'],
  [-39.3,176,'oc','North Island, NZ'],[10,-84.2,'na','Central American isthmus'],
  [45.9,7.0,'eu','Mont Blanc'],[43.2,-5.5,'eu','Cantabrian Mountains'],[56.8,-4.5,'eu','Scottish Highlands'],[47.2,11.3,'eu','Tyrolean Alps'],
  [42,13.8,'eu','Apennines'],[78.2,15.6,'eu','Svalbard'],[35.2,-106.3,'na','Rio Grande Rift'],[38.3,-122.5,'na','California Coast Ranges'],
  [58.5,-134.5,'na','Alaska Panhandle'],[-23.5,-46.5,'sa','Brazilian coastal range'],[-14.5,-47.5,'sa','Brazilian Highlands'],[-34.7,-58.3,'sa','Río de la Plata estuary'],
  [-34.3,-69.8,'sa','Mendoza Andes'],[-4.5,15.5,'af','Congo Basin'],[-23,17,'af','Namibian Plateau'],[-26,30,'af','South African Highveld'],
  [36.4,3.5,'af','Tell Atlas'],[33,131,'as','Kyushu'],[27.1,100.2,'as','Jade Dragon Snow Mountain'],[47.8,106.9,'as','Mongolian steppe'],
  [-23,119,'oc','Pilbara'],[-33.8,150.5,'oc','Sydney Basin'],[-42,146.5,'oc','Tasmania'],[21,73.5,'as','Western Ghats'],
  [41,-2.5,'eu','Iberian System'],[52,-120,'na','British Columbia Plateau'],[-12,-75,'sa','Eastern Andean slope'],
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
// Centres 80, 82-89 were added to the list after the pool shipped; leaving them out keeps the daily order unchanged.
const LATE = new Set([80, 82, 83, 84, 85, 86, 87, 88, 89]);
const puzzles = [];
for (let i = 0; i < C.length; i++) {
  const [lat, lng, region, place] = C[i];
  if (LATE.has(i)) continue;
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
