// raw/geom.json (WMO/GRDC basins) -> ../data.json : one entry per named river basin (sub-basins merged by family).
import fs from 'node:fs';
import { FACTS } from './facts.mjs';
const fc = JSON.parse(fs.readFileSync('raw/geom.json', 'utf8'));
// key = WMOBB_BASI in the source; name is the display label.
const L = [
  ['AMAZON (also Amazonas)', 'Amazon', ['Amazonas']],
  ['CONGO', 'Congo', ['Zaire']],
  ['NILE', 'Nile'],
  ['RIO DE LA PLATA', 'Río de la Plata', ['Parana', 'Paraná', 'La Plata']],
  ['MISSISSIPPI', 'Mississippi'],
  ['OB', 'Ob', ['Irtysh']],
  ['LENA and INDIGIRKA', 'Lena', ['Indigirka']],
  ['YENISEY', 'Yenisey', ['Yenisei']],
  ['CHAD', 'Lake Chad', ['Chad']],
  ['AMUR', 'Amur', ['Heilong', 'Heilongjiang']],
  ['TARIM HE (also TALIMU HE) and Tibetan plateau', 'Tarim', ['Tarim He']],
  ['NIGER', 'Niger', ['Benue']],
  ['MACKENZIE', 'Mackenzie'],
  ['YANGTZE', 'Yangtze', ['Chang Jiang']],
  ['VOLGA', 'Volga'],
  ['ZAMBEZI', 'Zambezi'],
  ['LAKE EYRE', 'Lake Eyre', ['Eyre']],
  ['NELSON and SASKATCHEWAN', 'Nelson', ['Saskatchewan']],
  ['MURRAY and DARLING', 'Murray-Darling', ['Murray', 'Darling']],
  ['SAINT LAWRENCE (also SAINT-LAURENT)', 'Saint Lawrence', ['St. Lawrence', 'Great Lakes']],
  ['GANGES', 'Ganges', ['Ganga']],
  ['ORANGE', 'Orange'],
  ['YELLOW RIVER', 'Yellow River', ['Huang He']],
  ['ORINOCO', 'Orinoco'],
  ['INDUS', 'Indus'],
  ['YUKON', 'Yukon'],
  ['ARAL SEA (SOUTH) and AMU DARYA', 'Amu Darya', ['Amudarya', 'Oxus']],
  ['JUBBA (also GENALE WENZ) (ex 180)', 'Jubba', ['Juba', 'Genale']],
  ['DANUBE', 'Danube'],
  ['MEKONG', 'Mekong', ['Lancang']],
  ['TOCANTINS', 'Tocantins'],
  ['OKAVANGO (also CUBANGO)', 'Okavango', ['Cubango']],
  ['RIO GRANDE (also BRAVO)', 'Rio Grande', ['Rio Bravo']],
  ['COLUMBIA', 'Columbia'],
  ['COLORADO (also COLORADO RIVER)', 'Colorado'],
  ['SAO FRANCISCO', 'São Francisco', ['Sao Francisco']],
  ['EUPHRATES and TIGRIS in Asia', 'Euphrates–Tigris', ['Euphrates', 'Tigris']],
  ['BRAHMAPUTRA', 'Brahmaputra', ['Yarlung Tsangpo']],
  ['DNIEPER', 'Dnieper', ['Dnipro']],
  ['BALKHASH and ALAKOL', 'Lake Balkhash', ['Balkhash']],
  ['SENEGAL', 'Senegal'],
  ['ZHU JIANG', 'Pearl River', ['Zhu Jiang']],
  ['DON', 'Don'],
  ['IRRAWADDY', 'Irrawaddy'],
  ['ARAL SEA (NORTH) and SYR DARYA', 'Syr Darya', ['Syrdarya']],
  ['VOLTA', 'Volta'],
  ['LIMPOPO', 'Limpopo'],
  ['HAMUN', 'Helmand', ['Hamun']],
  ['GODAVARI', 'Godavari'],
  ['NEVA', 'Neva', ['Lake Ladoga', 'Ladoga']],
  ['SALWEEN', 'Salween', ['Nujiang', 'Thanlwin']],
  ['MAGDALENA', 'Magdalena'],
  ['FRASER', 'Fraser'],
  ['LIAO HE', 'Liao He', ['Liao']],
  ['OGOOUE', 'Ogooué', ['Ogooue']],
  ['VISTULA', 'Vistula', ['Wisla']],
  ['KURA and ARAS', 'Kura–Aras', ['Kura', 'Aras']],
  ['LAKE TURKANA', 'Lake Turkana', ['Turkana']],
  ['RUFIJI', 'Rufiji'],
  ['RUVUMA (also ROVUMA)', 'Ruvuma', ['Rovuma']],
  ['RHINE', 'Rhine'],
  ['CHAO PHRAYA', 'Chao Phraya'],
  ['RED (Pacific Ocean)', 'Red River', ['Song Hong', 'Hong']],
  ['ELBE', 'Elbe'],
  ['MAHANADI', 'Mahanadi'],
  ['SANAGA', 'Sanaga'],
  ['USUMACINTA and GRIJALVA', 'Usumacinta–Grijalva', ['Usumacinta', 'Grijalva']],
  ['ODER', 'Oder', ['Odra']],
  ['LOIRE', 'Loire'],
  ['KUNENE (also CUNENE)', 'Kunene', ['Cunene']],
  ['TITICACA (ex 355) and POOPO', 'Lake Titicaca', ['Titicaca']],
  ['SAVE', 'Save', ['Sabi']],
  ['PO', 'Po'],
  ['SEINE', 'Seine'],
  ['EBRO', 'Ebro'],
  ['DOURO (also DUERO)', 'Douro', ['Duero']],
  ['TAGUS', 'Tagus', ['Tejo']],
  ['GUADIANA', 'Guadiana'],
  ['KARUN', 'Karun'],
  ['NEMAN (also NEMUNAS, also NYOMAN)', 'Neman', ['Nemunas']],
  ['GAMBIA', 'Gambia'],
  ['FLY RIVER', 'Fly River'],
  ['ESSEQUIBO, AMACURO (also AMAKURA) and BARIMA', 'Essequibo'],
  ['YALU RIVER', 'Yalu'],
  ['COURANTYNE', 'Courantyne'],
  ['MARONI', 'Maroni'],
];
const byKey = new Map();
for (const f of fc.features) {
  const k = f.properties.WMOBB_BASI;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(f);
}
const r1 = (n) => Math.round(n * 100) / 100; // 0.01° grid
const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; };
const out = [];
for (const [key, name, aliases = []] of L) {
  const fs_ = byKey.get(key);
  if (!fs_) { console.error('MISSING', key); continue; }
  const polys = [];
  let area = 0, subs = 0;
  for (const f of fs_) {
    area += f.properties.SUM_SUB_AR; subs++;
    const g = f.geometry;
    for (const p of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) polys.push(p);
  }
  // centroid (planar, area-weighted outer rings) + bbox; keep outer rings > threshold, all holes dropped
  let cx = 0, cy = 0, ca = 0, minx = 999, maxx = -999, miny = 999, maxy = -999;
  const rings = [];
  for (const p of polys) {
    const ring = p[0];
    const a = Math.abs(ringArea(ring));
    for (const [x, y] of ring) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
      const c = x0 * y1 - x1 * y0; const w = c / 2;
      cx += (x0 + x1) * c / 6; cy += (y0 + y1) * c / 6; ca += w;
    }
    if (a > 0.03) rings.push(ring.map(([x, y]) => [r1(x), r1(y)]));
  }
  const region = fs_[0].properties.REGNAME;
  out.push({
    id: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') || key,
    name, aliases, region,
    area: Math.round(area), subs,
    mouth: FACTS[name][0], note: FACTS[name][1],
    lat: +(cy / ca).toFixed(2), lng: +(cx / ca).toFixed(2),
    bbox: [minx, miny, maxx, maxy].map((v) => +v.toFixed(2)),
    rings,
  });
}
// If a centroid falls outside (multi-ring noise) it's still fine for distance feedback.
for (const n of Object.keys(FACTS)) if (!out.some((r) => r.name === n)) throw new Error('facts without basin: ' + n);
const data = { source: 'WMO Basins and Sub-basins 3rd ed. (GRDC 2020)', rivers: out };
fs.writeFileSync('../data.json', JSON.stringify(data));
console.log(out.length, 'rivers', (fs.statSync('../data.json').size / 1e6).toFixed(2), 'MB');
