// raw EIA-930 hourly balance CSVs -> data.json (pool of BA-days with hourly fuel mix)
import fs from 'fs';
const FILES = ['EIA930_BALANCE_2025_Jul_Dec.csv', 'EIA930_BALANCE_2026_Jan_Jun.csv', 'EIA930_BALANCE_2026_Jul_Dec.csv'];
// raw 1-based column numbers; adjusted = raw + 32
const FUELS = { coal: [17], gas: [18], nuclear: [19], oil: [20], hydro: [21], solar: [23, 24], wind: [25, 26], other: [22, 27, 28, 29, 30, 31, 32] };
const BA = {
  PJM: ['PJM 互联', '大西洋中部/中西部'], MISO: ['MISO 中部', '中西部'], ERCO: ['ERCOT 德州', '德克萨斯'], SWPP: ['西南电力池', '中部平原'],
  SOCO: ['南方公司', '东南部'], CISO: ['加州 CAISO', '加利福尼亚'], TVA: ['田纳西河谷管理局', '田纳西'], FPL: ['佛州电力 FPL', '佛罗里达'],
  NYIS: ['纽约 NYISO', '纽约'], ISNE: ['新英格兰 ISO', '新英格兰'], DUK: ['杜克能源（卡罗来纳）', '卡罗来纳'], BPAT: ['邦纳维尔电力局', '西北部'],
  SRP: ['盐河工程 SRP', '西南部'], CPLE: ['杜克能源进步（东）', '卡罗来纳'], PACE: ['太平洋电力（东）', '西北部/山区'], FPC: ['杜克能源佛州', '佛罗里达'],
  PSCO: ['科罗拉多公共服务', '山区'], NEVP: ['内华达能源', '山区'], WACM: ['WAPA 科罗拉多-密苏里', '山区'], LGEE: ['路易斯维尔电力', '中西部'],
  SCEG: ['南卡 SCE&G', '卡罗来纳'], AZPS: ['亚利桑那公共服务', '西南部'], AECI: ['联合电力合作社', '中西部'], TEC: ['坦帕电力', '佛罗里达'],
  LDWP: ['洛杉矶水电局', '加利福尼亚'], NWMT: ['西北能源（蒙大拿）', '山区'], FMPP: ['佛州市政电力池', '佛罗里达'], GRID: ['Gridforce 能源管理', '西北部'],
  SC: ['南卡 Santee Cooper', '卡罗来纳'],
};
const REG = { MIDA: '大西洋中部', MIDW: '中西部', TEX: '德克萨斯', CENT: '中部平原', SE: '东南部', CAL: '加利福尼亚', TEN: '田纳西', FLA: '佛罗里达', NY: '纽约', NE: '新英格兰', CAR: '卡罗来纳', NW: '西北/山区', SW: '西南部' };
const num = (s) => (s === '' || s === undefined ? NaN : Number(s));
const rows = {}; const meta = {};
for (const f of FILES) {
  const L = fs.readFileSync(new URL(`./raw/${f}`, import.meta.url), 'utf8').split('\n');
  for (const l of L.slice(1)) {
    if (!l) continue;
    const c = l.split(',');
    const b = c[0];
    if (!BA[b]) continue;
    const [m, d, y] = c[1].split('/');
    const date = `${y}-${m}-${d}`;
    const hr = +c[2];
    const f2 = {};
    for (const [k, cols] of Object.entries(FUELS)) {
      let s = 0;
      for (const col of cols) { const a = num(c[col + 31]); const r = num(c[col - 1]); const v = Number.isFinite(a) ? a : Number.isFinite(r) ? r : 0; s += k === 'other' ? Math.max(v, 0) : Math.max(v, 0); }
      f2[k] = s;
    }
    const net = num(c[14]) || num(c[7]) || 0;
    // utc offset (hours) from local vs UTC "end of hour" stamps
    const lt = Date.parse(c[3].replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2') + ' UTC'); const ut = Date.parse(c[4].replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2') + ' UTC');
    ((rows[b] ??= {})[date] ??= {})[hr] = { f: f2, net };
    if (m === '01' && !Number.isNaN(lt - ut)) meta[b] = { off: Math.round((lt - ut) / 3.6e6), reg: REG[c[c.length - 1].trim()] };
  }
}
const FK = Object.keys(FUELS);
const MIN_GOOD = 60, MIN_MEAN = 1500, PER_BA = 6;
const bas = []; const days = {}; const dropped = {};
for (const [b, byDate] of Object.entries(rows)) {
  const good = []; let why = { dst: 0, gap: 0, mismatch: 0 };
  for (const [date, hrs] of Object.entries(byDate)) {
    const hs = Object.keys(hrs).map(Number);
    if (hs.length !== 24 || !Array.from({ length: 24 }, (_, i) => hrs[i + 1]).every(Boolean)) { why.dst++; continue; } // DST-change days / partial days
    const tot = []; let ok = true;
    for (let h = 1; h <= 24; h++) { const t = FK.reduce((a, k) => a + hrs[h].f[k], 0); tot.push(t); if (t <= 0) ok = false; }
    const sumT = tot.reduce((a, b2) => a + b2, 0), sumN = Array.from({ length: 24 }, (_, i) => hrs[i + 1].net).reduce((a, b2) => a + b2, 0);
    if (!ok) { why.gap++; continue; }
    if (sumN <= 0 || Math.abs(sumT / sumN - 1) > 0.1) { why.mismatch++; continue; }
    good.push({ date, hrs, mean: sumT / 24 });
  }
  dropped[b] = { good: good.length, ...why };
  if (good.length < MIN_GOOD) continue;
  const mean = good.reduce((a, g) => a + g.mean, 0) / good.length;
  if (mean < MIN_MEAN) continue;
  const tot = Object.fromEntries(FK.map((k) => [k, good.reduce((a, g) => a + Array.from({ length: 24 }, (_, i) => g.hrs[i + 1].f[k]).reduce((x, y) => x + y, 0), 0)]));
  const all = FK.reduce((a, k) => a + tot[k], 0);
  // typical mix over every good day, whole percent, fuels >= 1 %
  const typ = Object.fromEntries(FK.map((k) => [k, Math.round((tot[k] / all) * 100)]).filter(([, v]) => v >= 1));
  bas.push({ id: b, name: BA[b][0], area: meta[b].reg ?? BA[b][1], off: meta[b].off, mean: Math.round(mean), typ });
  days[b] = good;
}
console.error('dropped/kept:', JSON.stringify(dropped));
// deterministic pick: one day per ~2-month window (season coverage), hash-ordered inside each window
const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0); };
const puzzles = [];
for (const b of bas) {
  const sorted = days[b.id].slice().sort((a, c) => (a.date < c.date ? -1 : 1));
  const chunk = sorted.length / PER_BA;
  for (let i = 0; i < PER_BA; i++) {
    const win = sorted.slice(Math.floor(i * chunk), Math.floor((i + 1) * chunk));
    const g = win.map((g2) => ({ g2, k: hash(b.id + g2.date) })).sort((a, c) => a.k - c.k)[0].g2;
    const m = {};
    for (const k of FK) m[k] = Array.from({ length: 24 }, (_, i2) => Math.round(g.hrs[i2 + 1].f[k] / 10));
    puzzles.push({ ba: b.id, date: g.date, m });
  }
}
puzzles.sort((a, c) => (a.date + a.ba < c.date + c.ba ? -1 : 1));
const dates = puzzles.map((p) => p.date);
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ fuels: FK, bas, puzzles, unit: 10, period: `${dates[0]}..${dates.at(-1)}` }));
console.log(bas.length, 'BAs', puzzles.length, 'puzzles', bas.map((b) => `${b.id}${b.off}`).join(' '));
