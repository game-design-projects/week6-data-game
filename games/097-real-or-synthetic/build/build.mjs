import fs from 'node:fs';
import { mulberry, surrogate, norm100, METHODS, diff, std } from './synth.mjs';
const raw = (n) => fs.readFileSync(new URL(`./raw/${n}`, import.meta.url), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
const ym = (s) => s.slice(0, 7);
const S = []; // {id,name,unit,log,src,pts:[[ym,val]]}
const add = (id, name, desc, log, src, pts) => S.push({ id, name, desc, log, src, pts: pts.filter(([, v]) => Number.isFinite(v) && (!log || v > 0)) });
add('brent', 'Brent crude oil price', 'USD per barrel', true, 'EIA', raw('oil-prices_main_data_brent-monthly.csv').map((r) => [ym(r[0]), +r[1]]));
add('wti', 'WTI crude oil price', 'USD per barrel', true, 'EIA', raw('oil-prices_main_data_wti-monthly.csv').map((r) => [ym(r[0]), +r[1]]));
const sp = raw('s-and-p-500_main_data_data.csv');
add('sp500', 'S&P 500 index', 'points', true, 'Shiller', sp.map((r) => [ym(r[0]), +r[1]]));
add('spdiv', 'S&P 500 dividends', 'index-point equivalent', true, 'Shiller', sp.filter((r) => +r[2] > 0 && ym(r[0]) < '2023').map((r) => [ym(r[0]), +r[2]]));
add('speps', 'S&P 500 earnings', 'index-point equivalent', true, 'Shiller', sp.filter((r) => +r[3] > 0 && ym(r[0]) < '2023').map((r) => [ym(r[0]), +r[3]]));
add('cpi', 'US Consumer Price Index (CPI)', 'index', true, 'BLS', raw('cpi-us_main_data_cpiai.csv').map((r) => [ym(r[0]), +r[1]]));
add('gold', 'Gold price', 'USD per ounce', true, 'LBMA/Officer', raw('gold-prices_main_data_monthly.csv').map((r) => [ym(r[0]), +r[1]]));
add('co2', 'Mauna Loa atmospheric CO₂', 'ppm', false, 'NOAA GML', raw('co2-ppm_main_data_co2-mm-mlo.csv').map((r) => [ym(r[0]), +r[3]]));
const tp = raw('global-temp_main_data_monthly.csv');
add('gcag', 'Global monthly temperature anomaly (NOAA)', '°C', false, 'NOAA', tp.filter((r) => r[0] === 'GCAG').map((r) => [r[1], +r[2]]));
add('gistemp', 'Global monthly temperature anomaly (NASA)', '°C', false, 'NASA GISS', tp.filter((r) => r[0] === 'GISTEMP').map((r) => [r[1], +r[2]]));
add('natgas', 'US natural gas price (Henry Hub)', 'USD per MMBtu', true, 'EIA', raw('natural-gas_main_data_monthly.csv').map((r) => [ym(r[0]), +r[1]]));
add('t10y', 'US 10-year Treasury yield', '%', false, 'Fed', raw('bond-yields-us-10y_main_data_monthly.csv').map((r) => [ym(r[0]), +r[1]]));
// exchange rates: monthly mean per country
const fx = new Map();
for (const [d, c, v] of raw('exchange-rates_main_data_daily.csv')) { if (!+v) continue; const k = c + '|' + ym(d); (fx.get(k) || fx.set(k, []).get(k)).push(+v); }
const byC = {};
for (const [k, v] of fx) { const [c, m] = k.split('|'); (byC[c] ||= []).push([m, v.reduce((a, b) => a + b) / v.length]); }
const NAMES = { 'United Kingdom': 'British pound', Switzerland: 'Swiss franc', Sweden: 'Swedish krona', Norway: 'Norwegian krone', Japan: 'Japanese yen', Canada: 'Canadian dollar', Australia: 'Australian dollar', India: 'Indian rupee', 'South Africa': 'South African rand', Thailand: 'Thai baht', 'South Korea': 'South Korean won', Mexico: 'Mexican peso', Brazil: 'Brazilian real', Denmark: 'Danish krone' };
for (const [c, z] of Object.entries(NAMES)) add('fx' + c.replace(/\W/g, ''), `${z} to US dollar exchange rate`, 'local currency per USD', true, 'Fed H.10', byC[c].sort((a, b) => (a[0] < b[0] ? -1 : 1)));

const W = 72, puzzles = [], r = mulberry(97);
const keys = Object.keys(METHODS);
// "jag" = how jittery the monthly steps are relative to their own size. Real smooth series (CPI, interpolated
// dividends) vs shuffled decoys is a free giveaway, so such windows are dropped (counted in `dropped`).
const jag = (x) => { const d = diff(x); return std(diff(d)) / (std(d) || 1e-9); };
const dropped = {};
for (const s of S) {
  const n = s.pts.length, want = Math.min(14, Math.floor((2 * n) / W) - 1); // up to 50% overlap between windows
  for (let w = 0; w < want; w++) {
    const lo = Math.round((w * (n - W)) / Math.max(1, want - 1)), seg = s.pts.slice(lo, lo + W);
    if (seg.length < W) continue;
    const x = seg.map(([, v]) => (s.log ? Math.log(v) : v));
    if (new Set(x).size < W * 0.5) { dropped[s.id] = (dropped[s.id] || 0) + 1; continue; } // flat/staircase
    const ms = keys.slice().sort(() => r() - 0.5).slice(0, 3);
    const raws = ms.map((m) => surrogate(m, x, r));
    if (!raws.every((v) => v.every(Number.isFinite) && new Set(v).size > W / 2)) { dropped[s.id] = (dropped[s.id] || 0) + 1; continue; } // degenerate surrogate
    const jr = jag(x), jd = raws.map(jag);
    if (jr < Math.min(...jd) * 0.8 || jr > Math.max(...jd) * 1.35) { dropped[s.id] = (dropped[s.id] || 0) + 1; continue; }
    puzzles.push({ s: s.id, from: seg[0][0], to: seg[W - 1][0], real: norm100(x), decoys: ms.map((m, i) => ({ m, v: norm100(raws[i]) })) });
  }
}
console.log('dropped as giveaways/flat:', JSON.stringify(dropped));
// Order the pool so that any 5 consecutive entries (cyclically) come from 5 different series, with windows
// of the same series spread out: greedy pick from the series with most windows left that was not used recently.
const order = () => {
  const left = new Map();
  for (const q of puzzles) (left.get(q.s) || left.set(q.s, []).get(q.s)).push(q);
  for (const l of left.values()) l.sort(() => r() - 0.5);
  const out = [], recent = [];
  while (out.length < puzzles.length) {
    const cand = [...left.entries()].filter(([k, l]) => l.length && !recent.includes(k));
    if (!cand.length) break;
    const top = Math.max(...cand.map(([, l]) => l.length));
    const pool = cand.filter(([, l]) => l.length >= top - 1);
    const [k, l] = pool[Math.floor(r() * pool.length)];
    out.push(l.pop()); recent.push(k); if (recent.length > 4) recent.shift();
  }
  // anything stranded at the tail is dropped rather than risk a duplicate series inside a day
  const k = out.slice(0, Math.floor(out.length / 5) * 5);
  const ok = k.every((q, i) => new Set([0, 1, 2, 3, 4].map((j) => k[(i + j) % k.length].s)).size === 5);
  return ok ? k : null;
};
let kept = null;
for (let t = 0; t < 500 && !kept; t++) kept = order();
if (!kept) throw new Error('series spread failed');
kept.forEach((q, i) => (q.id = i));
puzzles.length = 0; puzzles.push(...kept);
const series = Object.fromEntries(S.map((s) => [s.id, { name: s.name, unit: s.desc, log: s.log, src: s.src }]));
const methods = Object.fromEntries(keys.map((k) => [k, METHODS[k][0]]));
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ built: '2026-10-15', window: W, series, methods, puzzles }));
console.log(puzzles.length, 'puzzles', fs.statSync(new URL('../data.json', import.meta.url)).size, 'bytes');
