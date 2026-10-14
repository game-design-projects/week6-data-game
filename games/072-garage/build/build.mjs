// raw (SODA group-by + Census gazetteer) -> ../data.json
import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync('raw/county_make.json', 'utf8'));
const gaz = fs.readFileSync('raw/2023_Gaz_counties_national.txt', 'utf8').trim().split('\n');
const hdr = gaz[0].split('\t').map((s) => s.trim());
const ix = (k) => hdr.indexOf(k);
const MAKES = { TOYOT:'丰田 Toyota',HONDA:'本田 Honda',CHEVR:'雪佛兰 Chevrolet',FORD:'福特 Ford',NISSA:'日产 Nissan',SUBAR:'斯巴鲁 Subaru',JEEP:'Jeep',HYUND:'现代 Hyundai',KIA:'起亚 Kia',BMW:'宝马 BMW','ME/BE':'奔驰 Mercedes-Benz',MAZDA:'马自达 Mazda',VOLKS:'大众 Volkswagen',LEXUS:'雷克萨斯 Lexus',GMC:'GMC',DODGE:'道奇 Dodge',ACURA:'讴歌 Acura',RAM:'Ram',AUDI:'奥迪 Audi',BUICK:'别克 Buick',TESLA:'特斯拉 Tesla',VOLVO:'沃尔沃 Volvo',CADIL:'凯迪拉克 Cadillac',CHRYS:'克莱斯勒 Chrysler',INFIN:'英菲尼迪 Infiniti',LINCO:'林肯 Lincoln',MITSU:'三菱 Mitsubishi','LA/RO':'路虎 Land Rover',PORSC:'保时捷 Porsche',MINI:'MINI',PONTI:'庞蒂亚克 Pontiac',GENES:'捷尼赛思 Genesis',MERCU:'水星 Mercury',JAGUA:'捷豹 Jaguar',FIAT:'菲亚特 Fiat',SUZUK:'铃木 Suzuki',SATUR:'土星 Saturn',OLDSM:'奥兹莫比尔 Oldsmobile' };
const ZH = { ALBANY:'奥尔巴尼',ALLEGANY:'阿勒格尼',BRONX:'布朗克斯',BROOME:'布鲁姆',CATTARAUGUS:'卡塔劳格斯',CAYUGA:'卡尤加',CHAUTAUQUA:'肖托夸',CHEMUNG:'奇曼',CHENANGO:'切南戈',CLINTON:'克林顿',COLUMBIA:'哥伦比亚',CORTLAND:'科特兰',DELAWARE:'特拉华',DUTCHESS:'达奇斯',ERIE:'伊利',ESSEX:'埃塞克斯',FRANKLIN:'富兰克林',FULTON:'富尔顿',GENESEE:'杰纳西',GREENE:'格林',HAMILTON:'汉密尔顿',HERKIMER:'赫基默',JEFFERSON:'杰斐逊',KINGS:'国王郡（布鲁克林）',LEWIS:'刘易斯',LIVINGSTON:'利文斯顿',MADISON:'麦迪逊',MONROE:'门罗',MONTGOMERY:'蒙哥马利',NASSAU:'拿骚',NEW_YORK:'纽约郡（曼哈顿）',NIAGARA:'尼亚加拉',ONEIDA:'奥奈达',ONONDAGA:'奥农多加',ONTARIO:'安大略',ORANGE:'奥兰治',ORLEANS:'奥尔良',OSWEGO:'奥斯威戈',OTSEGO:'奥齐戈',PUTNAM:'普特南',QUEENS:'皇后区',RENSSELAER:'伦斯勒',RICHMOND:'里士满（史坦顿岛）',ROCKLAND:'罗克兰',ST_LAWRENCE:'圣劳伦斯',SARATOGA:'萨拉托加',SCHENECTADY:'斯克内克塔迪',SCHOHARIE:'斯科哈里',SCHUYLER:'斯凯勒',SENECA:'塞内卡',STEUBEN:'斯托本',SUFFOLK:'萨福克',SULLIVAN:'沙利文',TIOGA:'蒂奥加',TOMPKINS:'汤普金斯',ULSTER:'阿尔斯特',WARREN:'沃伦',WASHINGTON:'华盛顿',WAYNE:'韦恩',WESTCHESTER:'韦斯特切斯特',WYOMING:'怀俄明',YATES:'耶茨' };
const cent = {};
for (const line of gaz.slice(1)) {
  const f = line.split('\t').map((s) => s.trim());
  if (f[ix('USPS')] !== 'NY') continue;
  const n = f[ix('NAME')].replace(/ County$/, '').toUpperCase().replace(/^SAINT /, 'ST ').replace(/\./g, '');
  cent[n] = { lat: +f[ix('INTPTLAT')], lng: +f[ix('INTPTLONG')] };
}
// Gazetteer uses names like "New York", "Kings"
const by = {}; const state = {}; let stateTot = 0;
for (const r of raw) {
  if (r.county === 'OUT-OF-STATE') continue;
  const n = +r.n; (by[r.county] ??= {})[r.make] = n; state[r.make] = (state[r.make] || 0) + n; stateTot += n;
}
const counties = [];
for (const [c, mk] of Object.entries(by)) {
  if (!cent[c]) { console.error('no centroid', c); continue; }
  const tot = Object.values(mk).reduce((a, b) => a + b, 0);
  const named = Object.entries(mk).filter(([k]) => MAKES[k]).sort((a, b) => b[1] - a[1]);
  const top = named.slice(0, 10).map(([k, v]) => [k, +(v / tot * 100).toFixed(1)]);
  const lift = Object.entries(mk).filter(([k]) => MAKES[k] && state[k] / stateTot > 0.004 && mk[k] / tot > 0.004)
    .map(([k, v]) => [k, +((v / tot) / (state[k] / stateTot)).toFixed(2), +(v / tot * 100).toFixed(1)]).sort((a, b) => b[1] - a[1]);
  counties.push({ id: c, zh: ZH[c.replace(/ /g, '_')] || c, ...cent[c], total: tot, top, over: lift.slice(0, 3), under: lift.slice(-2).reverse(), tesla: +((mk.TESLA || 0) / tot * 100).toFixed(1) });
}
counties.sort((a, b) => a.id.localeCompare(b.id));
const stateShare = Object.fromEntries(Object.entries(state).filter(([k]) => MAKES[k]).map(([k, v]) => [k, +(v / stateTot * 100).toFixed(1)]));
fs.writeFileSync('../data.json', JSON.stringify({ asOf: '2026-10', makes: MAKES, stateShare, stateTotal: stateTot, counties }));
console.log(counties.length, 'counties');
