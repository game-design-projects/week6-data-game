// raw FRED csv -> data.json (monthly series, aligned to a common month axis)
import fs from 'node:fs';
const raw = (id) => fs.readFileSync(new URL(`./raw/${id}.csv`, import.meta.url), 'utf8').trim().split('\n').slice(1).map((l) => l.split(',')).filter((r) => r[1] && r[1] !== '.');
const monthly = (rows) => { // average within month; carry quarterly values forward
  const m = new Map(); for (const [d, v] of rows) { const k = d.slice(0, 7); (m.get(k) ?? m.set(k, []).get(k)).push(+v); }
  return new Map([...m].map(([k, a]) => [k, a.reduce((x, y) => x + y) / a.length]));
};
const addM = (k, n) => { const [y, mo] = k.split('-').map(Number); const t = y * 12 + mo - 1 + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
const S = [
  { id: 'UNRATE', unit: '%', name: 'US unemployment rate', yoy: false, tip: 'Unemployment jumps during and after recessions and drifts back down slowly in recovery: a sawtooth that climbs steeply and falls gently.' },
  { id: 'CPIAUCSL', unit: '%', name: 'US inflation (CPI, year over year)', yoy: true, tip: 'Big spikes in the 1970s and 2021-22, long low and steady stretches after the 1980s, and brief negative readings in 2009 and 2020.' },
  { id: 'FEDFUNDS', unit: '%', name: 'Federal funds rate', yoy: false, tip: 'Rates are pushed up before a recession and slashed during it. The early-1980s peak and the 2009-15 zero-rate floor are the signatures.' },
  { id: 'GS10', unit: '%', name: '10-year Treasury yield', yoy: false, tip: 'After peaking in 1981 it fell almost without pause for forty years, much smoother than the fed funds rate.' },
  { id: 'INDPRO', unit: '%', name: 'Industrial production (year over year)', yoy: true, tip: 'Almost always deeply negative inside a recession shade, and far more volatile than GDP.' },
  { id: 'PAYEMS', unit: '%', name: 'Nonfarm payrolls (year over year)', yoy: true, tip: 'Steady positive growth in normal times, negative in recessions; the 2020 drop is a cliff.' },
  { id: 'HOUST', unit: 'k units', name: 'Housing starts', yoy: false, tip: 'The most rate-sensitive series, it collapses before recessions. The 2006-09 housing bust is the signature.' },
  { id: 'UMCSENT', unit: 'pts', from: '1978-01', name: 'Michigan consumer sentiment', yoy: false, tip: 'Noisy with no obvious trend; plunges in recessions and oil shocks.' },
  { id: 'M2SL', unit: '%', name: 'M2 money supply (year over year)', yoy: true, tip: 'The unprecedented surge in 2020-21 is the giveaway; the rest of the time it swings between 0 and 12%.' },
  { id: 'DEXJPUS', unit: 'yen/USD', name: 'Yen per US dollar', yoy: false, tip: 'A long decline from 1971 to 1995 (a rising yen), then oscillation between 80 and 160.' },
  { id: 'GDPC1', unit: '%', name: 'Real GDP (year over year)', yoy: true, tip: 'Quarterly data, so the line is a staircase; negative only in a few periods.' },
  { id: 'TOTALSA', unit: 'M vehicles', name: 'Light vehicle sales (annualized, millions)', yoy: false, tip: 'Two deep pits in 2009 and April 2020; even seasonally adjusted it is very sensitive to recessions.' },
  { id: 'MORTGAGE30US', unit: '%', name: '30-year mortgage rate', yoy: false, tip: 'Tracks the 10-year Treasury: above 18% in 1981, below 3% in 2021.' },
  { id: 'CIVPART', unit: '%', name: 'Labor force participation rate', yoy: false, tip: 'Rose sharply from 1960 to 2000 (women entering work), then trended down after 2000; recessions act on it slowly.' },
  { id: 'PSAVERT', unit: '%', name: 'Personal saving rate', yoy: false, tip: 'High in the 1970s, sliding from 1990 to 2005, and an unprecedented spike in 2020 during pandemic stimulus.' },
];
const rec = monthly(raw('USREC'));
const last = [...rec.keys()].sort().pop();
const out = { source: 'FRED', rec: { start: [...rec.keys()].sort()[0], vals: '' }, series: [] };
for (const s of S) {
  const mm = monthly(raw(s.id));
  const keys = [...mm.keys()].sort();
  let first = keys[0], end = keys[keys.length - 1];
  if (s.id === 'GDPC1') { // forward-fill quarters to months
    for (const k of keys) for (const n of [1, 2]) if (!mm.has(addM(k, n))) mm.set(addM(k, n), mm.get(k));
    end = addM(end, 2);
  }
  let vals = []; let start = s.from ?? first;
  if (s.yoy) { start = addM(first, 12); }
  for (let k = start; k <= end; k = addM(k, 1)) {
    const v = mm.get(k); if (v == null) { console.log("gap, truncating", s.id, k); break; }
    vals.push(s.yoy ? (v / mm.get(addM(k, -12)) - 1) * 100 : v);
  }
  const mag = Math.max(...vals.map(Math.abs));
  const dp = mag >= 1000 ? 0 : mag >= 100 ? 1 : 2;
  out.series.push({ id: s.id, name: s.name, unit: s.unit, tip: s.tip, yoy: s.yoy, start, vals: vals.map((v) => +v.toFixed(dp)) });
}
const rk = [...rec.keys()].sort(); out.rec.vals = rk.map((k) => (rec.get(k) > 0.5 ? 1 : 0)).join('');
out.rec.start = rk[0];
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log(out.series.map((s) => `${s.id} ${s.start} n=${s.vals.length}`).join('\n'), 'rec', out.rec.start, rk.at(-1));
