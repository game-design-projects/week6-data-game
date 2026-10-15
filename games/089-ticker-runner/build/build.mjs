// Fetch 5-minute index bars from Yahoo Finance chart API (cached in build/raw), emit data.json.
import fs from 'node:fs'; import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const raw = path.join(dir, 'raw'); fs.mkdirSync(raw, { recursive: true });
const SYMS = [['^GSPC', 'S&P 500'], ['^IXIC', 'Nasdaq Composite'], ['^DJI', 'Dow Jones'], ['^RUT', 'Russell 2000']];
const N = 78;
const out = [];
for (const [sym, name] of SYMS) {
  const f = path.join(raw, sym.replace('^', '') + '.json');
  if (!fs.existsSync(f)) {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=60d&interval=5m`, { headers: { 'User-Agent': 'daily-data-games class project' } });
    fs.writeFileSync(f, await r.text()); await new Promise((r) => setTimeout(r, 1500));
  }
  const j = JSON.parse(fs.readFileSync(f, 'utf8')).chart.result[0];
  const off = j.meta.gmtoffset, ts = j.timestamp, cl = j.indicators.quote[0].close;
  const days = new Map();
  ts.forEach((t, i) => { if (cl[i] == null) return; const d = new Date((t + off) * 1000).toISOString().slice(0, 10); (days.get(d) ?? days.set(d, []).get(d)).push(cl[i]); });
  for (const [d, a] of days) {
    if (a.length < 70 || a.some((v) => !(v > 0))) continue; // skip half days / partial / bad bars
    const bars = Array.from({ length: N }, (_, k) => { const x = k * (a.length - 1) / (N - 1), i = Math.floor(x), fr = x - i; return +(a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * fr).toFixed(2); });
    if (bars.every((v) => v === bars[0])) continue; // flat line = no terrain
    out.push({ sym, name, date: d, bars });
  }
}
fs.writeFileSync(path.join(dir, '..', 'data.json'), JSON.stringify({ n: N, fetched: new Date().toISOString().slice(0, 10), days: out }));
console.log(out.length, 'days');
