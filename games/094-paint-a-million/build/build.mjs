// raw WorldPop rasters -> data.json (pool of 30x30 km windows). Run: node build/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTiff } from './tiff.mjs';
import { optimalCells } from '../game.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const N = 30, STRIDE = 5, MIN = 1.6e6, MAX = 8.0e6, PER_COUNTRY = 3, MAX_ZERO = 0.4, MIN_K = 8, MAX_K = 300;
const NAMES = { NLD: 'Netherlands', BEL: 'Belgium', CHE: 'Switzerland', AUT: 'Austria', PRT: 'Portugal', DNK: 'Denmark', ISR: 'Israel', LBN: 'Lebanon', KOR: 'South Korea', GHA: 'Ghana', KEN: 'Kenya', RWA: 'Rwanda', JOR: 'Jordan', ECU: 'Ecuador', UGA: 'Uganda', SEN: 'Senegal', CIV: 'Cote d\'Ivoire', LKA: 'Sri Lanka', NPL: 'Nepal', PHL: 'Philippines', VNM: 'Vietnam', GRC: 'Greece', HUN: 'Hungary', CZE: 'Czechia', IRL: 'Ireland', CHL: 'Chile', CUB: 'Cuba', DOM: 'Dominican Republic', GTM: 'Guatemala', TUN: 'Tunisia', MAR: 'Morocco', PER: 'Peru', COL: 'Colombia', MYS: 'Malaysia', KHM: 'Cambodia', SGP: 'Singapore', HKG: 'Hong Kong', TWN: 'Taiwan', ITA: 'Italy', GBR: 'United Kingdom', EGY: 'Egypt', NGA: 'Nigeria', PAK: 'Pakistan', BGD: 'Bangladesh', THA: 'Thailand', MEX: 'Mexico', ARG: 'Argentina', TUR: 'Turkey', IRN: 'Iran', IRQ: 'Iraq', SAU: 'Saudi Arabia', ZAF: 'South Africa', ETH: 'Ethiopia', TZA: 'Tanzania', AGO: 'Angola', DZA: 'Algeria', SYR: 'Syria', AFG: 'Afghanistan', VEN: 'Venezuela', UZB: 'Uzbekistan', MMR: 'Myanmar', SDN: 'Sudan', BOL: 'Bolivia', CMR: 'Cameroon', MLI: 'Mali', BFA: 'Burkina Faso', SOM: 'Somalia', MOZ: 'Mozambique', ZMB: 'Zambia', ZWE: 'Zimbabwe', MDG: 'Madagascar', HTI: 'Haiti', SLV: 'El Salvador', HND: 'Honduras', NIC: 'Nicaragua', PAN: 'Panama', CRI: 'Costa Rica', URY: 'Uruguay', PRY: 'Paraguay', SRB: 'Serbia', ROU: 'Romania', BGR: 'Bulgaria', POL: 'Poland', SWE: 'Sweden', NOR: 'Norway', FIN: 'Finland', UKR: 'Ukraine', BLR: 'Belarus', KAZ: 'Kazakhstan', AZE: 'Azerbaijan', GEO: 'Georgia', ARM: 'Armenia', KWT: 'Kuwait', ARE: 'UAE', OMN: 'Oman', YEM: 'Yemen', LAO: 'Laos', PRK: 'North Korea', MNG: 'Mongolia', IND: 'India', IDN: 'Indonesia', JPN: 'Japan', FRA: 'France', DEU: 'Germany', ESP: 'Spain', BRA: 'Brazil', CHN: 'China', USA: 'United States', RUS: 'Russia', CAN: 'Canada', AUS: 'Australia', COD: 'DR Congo' };
const ISO2 = { NLD: 'NL', BEL: 'BE', CHE: 'CH', AUT: 'AT', PRT: 'PT', DNK: 'DK', ISR: 'IL', LBN: 'LB', KOR: 'KR', GHA: 'GH', KEN: 'KE', RWA: 'RW', JOR: 'JO', ECU: 'EC', UGA: 'UG', SEN: 'SN', CIV: 'CI', LKA: 'LK', NPL: 'NP', PHL: 'PH', VNM: 'VN', GRC: 'GR', HUN: 'HU', CZE: 'CZ', IRL: 'IE', CHL: 'CL', CUB: 'CU', DOM: 'DO', GTM: 'GT', TUN: 'TN', MAR: 'MA', PER: 'PE', COL: 'CO', MYS: 'MY', KHM: 'KH', SGP: 'SG', HKG: 'HK', TWN: 'TW', ITA: 'IT', GBR: 'GB', EGY: 'EG', NGA: 'NG', PAK: 'PK', BGD: 'BD', THA: 'TH', MEX: 'MX', ARG: 'AR', TUR: 'TR', IRN: 'IR', IRQ: 'IQ', SAU: 'SA', ZAF: 'ZA', ETH: 'ET', TZA: 'TZ', AGO: 'AO', DZA: 'DZ', SYR: 'SY', AFG: 'AF', VEN: 'VE', UZB: 'UZ', MMR: 'MM', SDN: 'SD', BOL: 'BO', CMR: 'CM', MLI: 'ML', BFA: 'BF', SOM: 'SO', MOZ: 'MZ', ZMB: 'ZM', ZWE: 'ZW', MDG: 'MG', HTI: 'HT', SLV: 'SV', HND: 'HN', NIC: 'NI', PAN: 'PA', CRI: 'CR', URY: 'UY', PRY: 'PY', SRB: 'RS', ROU: 'RO', BGR: 'BG', POL: 'PL', SWE: 'SE', NOR: 'NO', FIN: 'FI', UKR: 'UA', BLR: 'BY', KAZ: 'KZ', AZE: 'AZ', GEO: 'GE', ARM: 'AM', KWT: 'KW', ARE: 'AE', OMN: 'OM', YEM: 'YE', LAO: 'LA', PRK: 'KP', MNG: 'MN', IND: 'IN', IDN: 'ID', JPN: 'JP', FRA: 'FR', DEU: 'DE', ESP: 'ES', BRA: 'BR', CHN: 'CN', USA: 'US', RUS: 'RU', CAN: 'CA', AUS: 'AU', COD: 'CD' };
const cities = fs.readFileSync(path.join(here, 'raw/cities15000.txt'), 'utf8').split('\n').filter(Boolean).map((l) => {
  const f = l.split('\t'); return { name: f[1], lat: +f[4], lng: +f[5], cc: f[8], pop: +f[14] };
});
// nearest city (by distance, discounted by size); null if none within 40 km
const near = (lat, lng, cc) => {
  let best = null, bd = 1e9;
  for (const c of cities) {
    if (c.cc !== cc) continue;
    const d = Math.hypot((c.lat - lat) * 111, (c.lng - lng) * 111 * Math.cos(lat * Math.PI / 180)) - Math.log10(c.pop) * 3;
    if (d < bd) { bd = d; best = c; }
  }
  return best && bd < 40 ? best.name : null;
};
let seed = 94;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pool = [];
for (const iso of Object.keys(NAMES)) {
  const f = path.join(here, 'raw', `${iso.toLowerCase()}.tif`);
  if (!fs.existsSync(f)) continue;
  const t = readTiff(fs.readFileSync(f));
  const cand = [];
  for (let y = 0; y + N <= t.H; y += STRIDE) for (let x = 0; x + N <= t.W; x += STRIDE) {
    let s = 0, bad = 0, zero = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = t.data[(y + j) * t.W + x + i]; if (!(v >= 0)) bad++; else { s += v; if (v < 0.5) zero++; } }
    if (s >= MIN && s <= MAX && bad < N * N * 0.03 && zero < N * N * MAX_ZERO) cand.push({ x, y, s });
  }
  cand.sort(() => rnd() - 0.5);
  const chosen = [];
  for (const c of cand) {
    if (chosen.length >= PER_COUNTRY) break;
    if (!chosen.every((o) => Math.abs(o.x - c.x) >= N + 5 || Math.abs(o.y - c.y) >= N + 5)) continue;
    const cells = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = t.data[(c.y + j) * t.W + c.x + i]; cells.push(v >= 0 ? Math.round(v) : 0); }
    const k = optimalCells(cells).k;
    if (k < MIN_K || k > MAX_K) continue; // too trivial / too flat to be a fair puzzle
    chosen.push({ ...c, cells });
  }
  for (const c of chosen) {
    const lat = t.y0 - (c.y + N / 2) * t.dy, lng = t.x0 + (c.x + N / 2) * t.dx, cells = c.cells;
    const km2 = +((t.dx * 111.32 * Math.cos(lat * Math.PI / 180)) * (t.dy * 110.57)).toFixed(3);
    pool.push({ iso, country: NAMES[iso], place: near(lat, lng, ISO2[iso]), lat: +lat.toFixed(3), lng: +lng.toFixed(3), km2, total: cells.reduce((a, b) => a + b, 0), cells });
  }
  console.log(iso, cand.length, chosen.length);
}
// deterministic shuffle so consecutive days differ in country
pool.sort(() => rnd() - 0.5);
fs.writeFileSync(path.join(here, '../data.json'), JSON.stringify({ n: N, year: 2020, puzzles: pool }));
console.log('puzzles', pool.length, fs.statSync(path.join(here, '../data.json')).size);
