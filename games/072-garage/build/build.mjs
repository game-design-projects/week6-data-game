// raw (SODA group-by + Census gazetteer) -> ../data.json
import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync('raw/county_make.json', 'utf8'));
const gaz = fs.readFileSync('raw/2023_Gaz_counties_national.txt', 'utf8').trim().split('\n');
const hdr = gaz[0].split('\t').map((s) => s.trim());
const ix = (k) => hdr.indexOf(k);
const MAKES = { TOYOT:'Toyota',HONDA:'Honda',CHEVR:'Chevrolet',FORD:'Ford',NISSA:'Nissan',SUBAR:'Subaru',JEEP:'Jeep',HYUND:'Hyundai',KIA:'Kia',BMW:'BMW','ME/BE':'Mercedes-Benz',MAZDA:'Mazda',VOLKS:'Volkswagen',LEXUS:'Lexus',GMC:'GMC',DODGE:'Dodge',ACURA:'Acura',RAM:'Ram',AUDI:'Audi',BUICK:'Buick',TESLA:'Tesla',VOLVO:'Volvo',CADIL:'Cadillac',CHRYS:'Chrysler',INFIN:'Infiniti',LINCO:'Lincoln',MITSU:'Mitsubishi','LA/RO':'Land Rover',PORSC:'Porsche',MINI:'MINI',PONTI:'Pontiac',GENES:'Genesis',MERCU:'Mercury',JAGUA:'Jaguar',FIAT:'Fiat',SUZUK:'Suzuki',SATUR:'Saturn',OLDSM:'Oldsmobile',SAAB:'Saab',RIVIA:'Rivian',MASER:'Maserati',PLYMO:'Plymouth',HUMME:'Hummer',SMART:'smart',FERRA:'Ferrari',BENTL:'Bentley',MG:'MG',LUCID:'Lucid',TRIUM:'Triumph','AL/RO':'Alfa Romeo',LAMBO:'Lamborghini','RO/RO':'Rolls-Royce','AS/MA':'Aston Martin',DATSU:'Datsun',ISUZU:'Isuzu',INEOS:'Ineos',LOTUS:'Lotus',GEO:'Geo',MCLAR:'McLaren' };
// DMV spells the same make several ways; fold them together
const ALIAS = { CHEV:'CHEVR', CHEVY:'CHEVR', OLDS:'OLDSM', PONT:'PONTI', PLYM:'PLYMO', MERCE:'ME/BE', MGB:'MG' };
const ORIGIN = { us:'CHEVR FORD GMC RAM DODGE JEEP CHRYS BUICK CADIL LINCO TESLA PONTI MERCU SATUR OLDSM PLYMO HUMME RIVIA LUCID GEO', asia:'TOYOT HONDA NISSA SUBAR HYUND KIA MAZDA LEXUS ACURA INFIN MITSU GENES SUZUK ISUZU DATSU MG', eu:'BMW ME/BE VOLKS AUDI VOLVO LA/RO PORSC MINI JAGUA FIAT SAAB MASER SMART FERRA BENTL TRIUM AL/RO LAMBO RO/RO AS/MA INEOS LOTUS MCLAR' };
const ORIG_OF = {}; for (const [o, l] of Object.entries(ORIGIN)) for (const k of l.split(' ')) ORIG_OF[k] = o;
const oshare = (mk, tot) => ['us', 'asia', 'eu'].map((o) => +(Object.entries(mk).filter(([k]) => ORIG_OF[k] === o).reduce((a, [, v]) => a + v, 0) / tot * 100).toFixed(1));
const NAMES = { KINGS: 'Kings (Brooklyn)', NEW_YORK: 'New York (Manhattan)', RICHMOND: 'Richmond (Staten Island)', ST_LAWRENCE: 'St. Lawrence' };
const cap = (id) => id.toLowerCase().replace(/(^|[\s_-])\w/g, (m) => m.toUpperCase()).replace(/_/g, ' ');
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
  const n = +r.n; const m = ALIAS[r.make] || r.make; const b = (by[r.county] ??= {}); b[m] = (b[m] || 0) + n; state[m] = (state[m] || 0) + n; stateTot += n;
}
const counties = [];
for (const [c, mk] of Object.entries(by)) {
  if (!cent[c]) { console.error('no centroid', c); continue; }
  const tot = Object.values(mk).reduce((a, b) => a + b, 0);
  const named = Object.entries(mk).filter(([k]) => MAKES[k]).sort((a, b) => b[1] - a[1]);
  const top = named.slice(0, 10).map(([k, v]) => [k, +(v / tot * 100).toFixed(1)]);
  const lift = Object.entries(mk).filter(([k]) => MAKES[k] && state[k] / stateTot > 0.004 && mk[k] / tot > 0.004)
    .map(([k, v]) => [k, +((v / tot) / (state[k] / stateTot)).toFixed(2), +(v / tot * 100).toFixed(1)]).sort((a, b) => b[1] - a[1]);
  counties.push({ id: c, name: NAMES[c.replace(/ /g, '_')] || cap(c), ...cent[c], total: tot, top, over: lift.slice(0, 3), under: lift.slice(-2).reverse(), tesla: +((mk.TESLA || 0) / tot * 100).toFixed(1), orig: oshare(mk, tot) });
}
counties.sort((a, b) => a.id.localeCompare(b.id));
const stateShare = Object.fromEntries(Object.entries(state).filter(([k]) => MAKES[k]).map(([k, v]) => [k, +(v / stateTot * 100).toFixed(1)]));
fs.writeFileSync('../data.json', JSON.stringify({ asOf: '2026-10', makes: MAKES, stateShare, stateOrig: oshare(state, stateTot), stateTotal: stateTot, counties }));
const unm = Object.entries(state).filter(([k]) => !MAKES[k]).sort((a, b) => b[1] - a[1]);
console.log(counties.length, 'counties; unmapped makes cover', (unm.reduce((a, [, v]) => a + v, 0) / stateTot * 100).toFixed(2) + '%; largest:', unm.slice(0, 5).map(([k, v]) => k + ':' + v).join(' '));
