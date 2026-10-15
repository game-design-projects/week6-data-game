// raw EIA-930 hourly balance CSVs -> data.json (pool of BA-days with hourly fuel mix)
import fs from 'fs';
const FILES = ['EIA930_BALANCE_2025_Jul_Dec.csv', 'EIA930_BALANCE_2026_Jan_Jun.csv', 'EIA930_BALANCE_2026_Jul_Dec.csv'];
// raw 1-based column numbers; adjusted = raw + 32
const FUELS = { coal: [17], gas: [18], nuclear: [19], oil: [20], hydro: [21], solar: [23, 24], wind: [25, 26], other: [22, 27, 28, 29, 30, 31, 32] };
const BA = {
  PJM: ['PJM Interconnection', 'Mid-Atlantic / Midwest'], MISO: ['MISO (Midcontinent ISO)', 'Midwest'], ERCO: ['ERCOT', 'Texas'], SWPP: ['Southwest Power Pool', 'Central Plains'],
  SOCO: ['Southern Company', 'Southeast'], CISO: ['California ISO (CAISO)', 'California'], TVA: ['Tennessee Valley Authority', 'Tennessee'], FPL: ['Florida Power & Light', 'Florida'],
  NYIS: ['New York ISO (NYISO)', 'New York'], ISNE: ['ISO New England', 'New England'], DUK: ['Duke Energy Carolinas', 'Carolinas'], BPAT: ['Bonneville Power Administration', 'Northwest'],
  SRP: ['Salt River Project', 'Southwest'], CPLE: ['Duke Energy Progress East', 'Carolinas'], PACE: ['PacifiCorp East', 'Northwest / Mountain'], FPC: ['Duke Energy Florida', 'Florida'],
  PSCO: ['Public Service Co. of Colorado', 'Mountain'], NEVP: ['NV Energy', 'Mountain'], WACM: ['WAPA Colorado-Missouri', 'Mountain'], LGEE: ['Louisville Gas & Electric', 'Midwest'],
  SCEG: ['South Carolina Electric & Gas', 'Carolinas'], AZPS: ['Arizona Public Service', 'Southwest'], AECI: ['Associated Electric Cooperative', 'Midwest'], TEC: ['Tampa Electric', 'Florida'],
  LDWP: ['Los Angeles Dept. of Water & Power', 'California'], NWMT: ['NorthWestern Energy (Montana)', 'Mountain'], FMPP: ['Florida Municipal Power Pool', 'Florida'], GRID: ['Gridforce Energy Management', 'Northwest'],
  SC: ['Santee Cooper', 'Carolinas'],
};
const REG = { MIDA: 'Mid-Atlantic', MIDW: 'Midwest', TEX: 'Texas', CENT: 'Central Plains', SE: 'Southeast', CAL: 'California', TEN: 'Tennessee', FLA: 'Florida', NY: 'New York', NE: 'New England', CAR: 'Carolinas', NW: 'Northwest / Mountain', SW: 'Southwest' };
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
