// raw/geom.json (WMO/GRDC basins) -> ../data.json : one entry per named river basin (sub-basins merged by family).
import fs from 'node:fs';
const fc = JSON.parse(fs.readFileSync('raw/geom.json', 'utf8'));
// key = WMOBB_BASI in the source; name/zh are display labels.
const L = [
  ['AMAZON (also Amazonas)', 'Amazon', '亚马孙河', ['Amazonas']],
  ['CONGO', 'Congo', '刚果河', ['Zaire']],
  ['NILE', 'Nile', '尼罗河'],
  ['RIO DE LA PLATA', 'Río de la Plata', '拉普拉塔河', ['Parana', 'Paraná', 'La Plata']],
  ['MISSISSIPPI', 'Mississippi', '密西西比河'],
  ['OB', 'Ob', '鄂毕河', ['Irtysh']],
  ['LENA and INDIGIRKA', 'Lena', '勒拿河', ['Indigirka']],
  ['YENISEY', 'Yenisey', '叶尼塞河', ['Yenisei']],
  ['CHAD', 'Lake Chad', '乍得湖', ['Chad']],
  ['AMUR', 'Amur', '黑龙江（阿穆尔河）', ['Heilong', 'Heilongjiang']],
  ['TARIM HE (also TALIMU HE) and Tibetan plateau', 'Tarim', '塔里木河', ['Tarim He']],
  ['NIGER', 'Niger', '尼日尔河', ['Benue']],
  ['MACKENZIE', 'Mackenzie', '麦肯齐河'],
  ['YANGTZE', 'Yangtze', '长江', ['Chang Jiang']],
  ['VOLGA', 'Volga', '伏尔加河'],
  ['ZAMBEZI', 'Zambezi', '赞比西河'],
  ['LAKE EYRE', 'Lake Eyre', '艾尔湖', ['Eyre']],
  ['NELSON and SASKATCHEWAN', 'Nelson', '纳尔逊河', ['Saskatchewan']],
  ['MURRAY and DARLING', 'Murray-Darling', '墨累-达令河', ['Murray', 'Darling']],
  ['SAINT LAWRENCE (also SAINT-LAURENT)', 'Saint Lawrence', '圣劳伦斯河', ['St. Lawrence', 'Great Lakes']],
  ['GANGES', 'Ganges', '恒河', ['Ganga']],
  ['ORANGE', 'Orange', '奥兰治河'],
  ['YELLOW RIVER', 'Yellow River', '黄河', ['Huang He']],
  ['ORINOCO', 'Orinoco', '奥里诺科河'],
  ['INDUS', 'Indus', '印度河'],
  ['YUKON', 'Yukon', '育空河'],
  ['ARAL SEA (SOUTH) and AMU DARYA', 'Amu Darya', '阿姆河', ['Amudarya', 'Oxus']],
  ['JUBBA (also GENALE WENZ) (ex 180)', 'Jubba', '朱巴河', ['Juba', 'Genale']],
  ['DANUBE', 'Danube', '多瑙河'],
  ['MEKONG', 'Mekong', '湄公河', ['Lancang']],
  ['TOCANTINS', 'Tocantins', '托坎廷斯河'],
  ['OKAVANGO (also CUBANGO)', 'Okavango', '奥卡万戈河', ['Cubango']],
  ['RIO GRANDE (also BRAVO)', 'Rio Grande', '格兰德河（布拉沃河）', ['Rio Bravo']],
  ['COLUMBIA', 'Columbia', '哥伦比亚河'],
  ['COLORADO (also COLORADO RIVER)', 'Colorado', '科罗拉多河'],
  ['SAO FRANCISCO', 'São Francisco', '圣弗朗西斯科河', ['Sao Francisco']],
  ['EUPHRATES and TIGRIS in Asia', 'Euphrates–Tigris', '幼发拉底河-底格里斯河', ['Euphrates', 'Tigris']],
  ['BRAHMAPUTRA', 'Brahmaputra', '雅鲁藏布江（布拉马普特拉河）', ['Yarlung Tsangpo']],
  ['DNIEPER', 'Dnieper', '第聂伯河', ['Dnipro']],
  ['BALKHASH and ALAKOL', 'Lake Balkhash', '巴尔喀什湖', ['Balkhash']],
  ['SENEGAL', 'Senegal', '塞内加尔河'],
  ['ZHU JIANG', 'Pearl River', '珠江', ['Zhu Jiang']],
  ['DON', 'Don', '顿河'],
  ['IRRAWADDY', 'Irrawaddy', '伊洛瓦底江'],
  ['ARAL SEA (NORTH) and SYR DARYA', 'Syr Darya', '锡尔河', ['Syrdarya']],
  ['VOLTA', 'Volta', '沃尔特河'],
  ['LIMPOPO', 'Limpopo', '林波波河'],
  ['HAMUN', 'Helmand', '赫尔曼德河', ['Hamun']],
  ['GODAVARI', 'Godavari', '戈达瓦里河'],
  ['NEVA', 'Neva', '涅瓦河', ['Lake Ladoga', 'Ladoga']],
  ['SALWEEN', 'Salween', '萨尔温江', ['Nujiang', 'Thanlwin']],
  ['MAGDALENA', 'Magdalena', '马格达莱纳河'],
  ['FRASER', 'Fraser', '弗雷泽河'],
  ['LIAO HE', 'Liao He', '辽河', ['Liao']],
  ['OGOOUE', 'Ogooué', '奥果韦河', ['Ogooue']],
  ['VISTULA', 'Vistula', '维斯瓦河', ['Wisla']],
  ['KURA and ARAS', 'Kura–Aras', '库拉河-阿拉斯河', ['Kura', 'Aras']],
  ['LAKE TURKANA', 'Lake Turkana', '图尔卡纳湖', ['Turkana']],
  ['RUFIJI', 'Rufiji', '鲁菲吉河'],
  ['RUVUMA (also ROVUMA)', 'Ruvuma', '鲁伍马河', ['Rovuma']],
  ['RHINE', 'Rhine', '莱茵河'],
  ['CHAO PHRAYA', 'Chao Phraya', '湄南河（昭披耶河）'],
  ['RED (Pacific Ocean)', 'Red River', '红河（越南）', ['Song Hong', 'Hong']],
  ['ELBE', 'Elbe', '易北河'],
  ['MAHANADI', 'Mahanadi', '马哈纳迪河'],
  ['SANAGA', 'Sanaga', '萨纳加河'],
  ['USUMACINTA and GRIJALVA', 'Usumacinta–Grijalva', '乌苏马辛塔河-格里哈尔瓦河', ['Usumacinta', 'Grijalva']],
  ['ODER', 'Oder', '奥得河', ['Odra']],
  ['LOIRE', 'Loire', '卢瓦尔河'],
  ['KUNENE (also CUNENE)', 'Kunene', '库内内河', ['Cunene']],
  ['TITICACA (ex 355) and POOPO', 'Lake Titicaca', '的的喀喀湖', ['Titicaca']],
  ['SAVE', 'Save', '萨维河', ['Sabi']],
  ['PO', 'Po', '波河'],
  ['SEINE', 'Seine', '塞纳河'],
  ['EBRO', 'Ebro', '埃布罗河'],
  ['DOURO (also DUERO)', 'Douro', '杜罗河', ['Duero']],
  ['TAGUS', 'Tagus', '塔霍河', ['Tejo']],
  ['GUADIANA', 'Guadiana', '瓜迪亚纳河'],
  ['KARUN', 'Karun', '卡伦河'],
  ['NEMAN (also NEMUNAS, also NYOMAN)', 'Neman', '涅曼河', ['Nemunas']],
  ['GAMBIA', 'Gambia', '冈比亚河'],
  ['FLY RIVER', 'Fly River', '弗莱河'],
  ['OMO (also OMO WENZ)', 'Omo', '奥莫河'],
  ['ESSEQUIBO, AMACURO (also AMAKURA) and BARIMA', 'Essequibo', '埃塞奎博河'],
  ['YALU RIVER', 'Yalu', '鸭绿江'],
  ['WEBI SHABEELLE (also SHEBELE WENZ)', 'Shabelle', '谢贝利河', ['Shebelle', 'Shebele']],
  ['COURANTYNE', 'Courantyne', '科兰太因河'],
  ['MARONI', 'Maroni', '马罗尼河'],
  ['IGUAZU', 'Iguazú', '伊瓜苏河', ['Iguazu', 'Iguaçu']],
  ['TIETE', 'Tietê', '蒂特河', ['Tiete']],
];
const byKey = new Map();
for (const f of fc.features) {
  const k = f.properties.WMOBB_BASI;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(f);
}
const r1 = (n) => Math.round(n * 20) / 20; // 0.05° grid
const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; };
const out = [];
for (const [key, name, zh, aliases = []] of L) {
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
    id: name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') || key,
    name, zh, aliases, region,
    area: Math.round(area), subs,
    lat: +(cy / ca).toFixed(2), lng: +(cx / ca).toFixed(2),
    bbox: [minx, miny, maxx, maxy].map((v) => +v.toFixed(2)),
    rings,
  });
}
// If a centroid falls outside (multi-ring noise) it's still fine for distance feedback.
const data = { source: 'WMO Basins and Sub-basins 3rd ed. (GRDC 2020)', rivers: out };
fs.writeFileSync('../data.json', JSON.stringify(data));
console.log(out.length, 'rivers', (fs.statSync('../data.json').size / 1e6).toFixed(2), 'MB');
