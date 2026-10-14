// raw top lists -> pick spike article per day + co-spikers; fetch per-article 21-day series -> ../data.json
import fs from 'node:fs'; import path from 'node:path';
import { cached, iso } from './fetch.mjs';
const RAW = path.join(import.meta.dirname, 'raw');
const bad = (a) => /:/.test(a) || a === 'Main_Page' || a === '-' || /^Deaths_in_|^List_of_/.test(a) || /^\d{4}$/.test(a);
const top = {};
for (const f of fs.readdirSync(RAW).filter((f) => f.startsWith('top-'))) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  if (!j) continue;
  top[f.slice(4, 14)] = new Map(j.items[0].articles.map((x) => [x.article, x.views]));
}
const dates = Object.keys(top).sort();
const consecutive = (i) => [1, 2, 3].every((k) => Date.parse(dates[i] + 'T00:00:00Z') - Date.parse(dates[i - k] + 'T00:00:00Z') === k * 86400000);
const floorOf = (m) => Math.min(...m.values());
const puzzles = [];
for (let i = 4; i < dates.length; i++) {
  if (!consecutive(i)) continue;
  const D = dates[i], prev = [1, 2, 3].map((k) => top[dates[i - k]]);
  const spikes = [];
  for (const [a, v] of top[D]) {
    if (bad(a) || v < 40000) continue;
    const base = prev.reduce((s, m) => s + (m.get(a) ?? floorOf(m)), 0) / 3;
    spikes.push({ a, v, base, ratio: v / base, exact: prev.every((m) => m.has(a)) });
  }
  spikes.sort((x, y) => y.ratio - x.ratio);
  const win = spikes[0];
  if (!win || win.ratio < 3) continue;
  puzzles.push({ date: D, win, co: spikes.slice(1).filter((s) => s.ratio >= 2.2).slice(0, 5), top3: [...top[D].keys()].filter((a) => !bad(a)).slice(0, 3) });
}
console.log(puzzles.length, 'candidate days');
const dayAdd = (d, n) => iso(Date.parse(d + 'T00:00:00Z') + n * 86400000);
const out = [];
for (const p of puzzles) {
  if (p.co.length < 3) continue;
  const s = dayAdd(p.date, -20).replaceAll('-', ''), e = p.date.replaceAll('-', '');
  const j = await cached(`art-${p.date}-${p.win.a}.json`.replace(/[\/?]/g, '_'), `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(p.win.a)}/daily/${s}00/${e}00`);
  if (!j || j.items.length < 21) continue;
  const series = j.items.map((x) => x.views);
  out.push({
    date: p.date, title: p.win.a.replaceAll('_', ' '), id: p.win.a, views: p.win.v, ratio: +p.win.ratio.toFixed(1), exact: p.win.exact,
    series, // 21 daily views (user agents), ending on the spike day
    co: p.co.map((c) => ({ t: c.a.replaceAll('_', ' '), v: c.v, r: +c.ratio.toFixed(1) })),
  });
}
const ids = new Set(out.map((x) => x.title));
const pool = new Set(out.map((x) => x.title));
for (const o of out) for (const c of o.co) pool.add(c.t);
const data = { range: [dates[4], dates.at(-1)], puzzles: out, options: [...pool].sort() };
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify(data));
console.log(out.length, 'puzzles', pool.size, 'options', fs.statSync(path.join(import.meta.dirname, '..', 'data.json')).size);
console.log(out.slice(0, 8).map((o) => `${o.date} ${o.title} x${o.ratio} <- ${o.co.map((c) => c.t).join(', ')}`).join('\n'));
