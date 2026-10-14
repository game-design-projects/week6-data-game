import fs from 'node:fs';
import { mulberry, surrogate, norm100, METHODS } from './synth.mjs';
const raw = (n) => fs.readFileSync(new URL(`./raw/${n}`, import.meta.url), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
const ym = (s) => s.slice(0, 7);
const S = []; // {id,name,unit,log,src,pts:[[ym,val]]}
const add = (id, name, desc, log, src, pts) => S.push({ id, name, desc, log, src, pts: pts.filter(([, v]) => Number.isFinite(v) && (!log || v > 0)) });
add('brent', '布伦特原油价格', '美元/桶', true, 'EIA', raw('oil-prices_main_data_brent-monthly.csv').map((r) => [ym(r[0]), +r[1]]));
add('wti', 'WTI 原油价格', '美元/桶', true, 'EIA', raw('oil-prices_main_data_wti-monthly.csv').map((r) => [ym(r[0]), +r[1]]));
const sp = raw('s-and-p-500_main_data_data.csv');
add('sp500', '标普 500 指数', '点', true, 'Shiller', sp.map((r) => [ym(r[0]), +r[1]]));
add('spdiv', '标普 500 成分股分红', '指数点数折算', true, 'Shiller', sp.filter((r) => +r[2] > 0 && ym(r[0]) < '2023').map((r) => [ym(r[0]), +r[2]]));
add('speps', '标普 500 成分股盈利', '指数点数折算', true, 'Shiller', sp.filter((r) => +r[3] > 0 && ym(r[0]) < '2023').map((r) => [ym(r[0]), +r[3]]));
add('cpi', '美国消费者物价指数 CPI', '指数', true, 'BLS', raw('cpi-us_main_data_cpiai.csv').map((r) => [ym(r[0]), +r[1]]));
add('gold', '黄金价格', '美元/盎司', true, 'LBMA/Officer', raw('gold-prices_main_data_monthly.csv').map((r) => [ym(r[0]), +r[1]]));
add('co2', '莫纳罗亚大气 CO₂ 浓度', 'ppm', false, 'NOAA GML', raw('co2-ppm_main_data_co2-mm-mlo.csv').map((r) => [ym(r[0]), +r[3]]));
const tp = raw('global-temp_main_data_monthly.csv');
add('gcag', '全球月平均温度距平（NOAA）', '°C', false, 'NOAA', tp.filter((r) => r[0] === 'GCAG').map((r) => [r[1], +r[2]]));
add('gistemp', '全球月平均温度距平（NASA）', '°C', false, 'NASA GISS', tp.filter((r) => r[0] === 'GISTEMP').map((r) => [r[1], +r[2]]));
add('natgas', '美国天然气价格 (Henry Hub)', '美元/百万英热', true, 'EIA', raw('natural-gas_main_data_monthly.csv').map((r) => [ym(r[0]), +r[1]]));
add('t10y', '美国 10 年期国债收益率', '%', false, 'Fed', raw('bond-yields-us-10y_main_data_monthly.csv').map((r) => [ym(r[0]), +r[1]]));
// exchange rates: monthly mean per country
const fx = new Map();
for (const [d, c, v] of raw('exchange-rates_main_data_daily.csv')) { if (!+v) continue; const k = c + '|' + ym(d); (fx.get(k) || fx.set(k, []).get(k)).push(+v); }
const byC = {};
for (const [k, v] of fx) { const [c, m] = k.split('|'); (byC[c] ||= []).push([m, v.reduce((a, b) => a + b) / v.length]); }
const ZH = { 'United Kingdom': '英镑', Switzerland: '瑞士法郎', Sweden: '瑞典克朗', Norway: '挪威克朗', Japan: '日元', Canada: '加元', Australia: '澳元', India: '印度卢比', 'South Africa': '南非兰特', Thailand: '泰铢', 'South Korea': '韩元', Mexico: '墨西哥比索', Brazil: '巴西雷亚尔', Denmark: '丹麦克朗' };
for (const [c, z] of Object.entries(ZH)) add('fx' + c.replace(/\W/g, ''), `${z}兑美元汇率`, '当地货币/美元', true, 'Fed H.10', byC[c].sort((a, b) => (a[0] < b[0] ? -1 : 1)));

const W = 72, puzzles = [], r = mulberry(97);
const keys = Object.keys(METHODS);
let id = 0;
for (const s of S) {
  const n = s.pts.length, want = Math.min(8, Math.floor(n / W));
  for (let w = 0; w < want; w++) {
    const lo = Math.floor(((w + 0.15 + 0.7 * r()) * (n - W)) / want), seg = s.pts.slice(lo, lo + W);
    if (seg.length < W) continue;
    const x = seg.map(([, v]) => (s.log ? Math.log(v) : v));
    if (new Set(x).size < W * 0.5) continue; // too flat/staircase
    const ms = keys.slice().sort(() => r() - 0.5).slice(0, 3);
    const decoys = ms.map((m) => ({ m, v: norm100(surrogate(m, x, r)) }));
    puzzles.push({ id: id++, s: s.id, from: seg[0][0], to: seg[W - 1][0], real: norm100(x), decoys });
  }
}
const series = Object.fromEntries(S.map((s) => [s.id, { name: s.name, unit: s.desc, log: s.log, src: s.src }]));
const methods = Object.fromEntries(keys.map((k) => [k, METHODS[k][0]]));
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ built: '2026-10-14', window: W, series, methods, puzzles }));
console.log(puzzles.length, 'puzzles', fs.statSync(new URL('../data.json', import.meta.url)).size, 'bytes');
