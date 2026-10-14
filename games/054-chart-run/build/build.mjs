// raw CSVs (utdata/rwd-billboard-data) -> data.json. Run: node build/build.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const raw = (f) => fileURLToPath(new URL('./raw/' + f, import.meta.url));
const parse = (line) => { const out = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
const songs = new Map();
for (const [file, cols] of [['hot100_archive.csv', [0, 1, 2, 3]], ['cur.csv', [0, 1, 2, 3]]]) {
  const lines = fs.readFileSync(raw(file), 'utf8').split('\n').slice(1);
  for (const l of lines) {
    if (!l) continue;
    const c = parse(l); const [date, pos, title, perf] = cols.map((i) => c[i]);
    const k = title + '||' + perf;
    if (!songs.has(k)) songs.set(k, { title, perf, w: new Map() });
    songs.get(k).w.set(date, +pos);
  }
}
const DAY = 864e5;
const cands = [];
for (const s of songs.values()) {
  const dates = [...s.w.keys()].sort();
  const t0 = Date.parse(dates[0]), t1 = Date.parse(dates.at(-1));
  const span = Math.round((t1 - t0) / DAY / 7) + 1;
  const peak = Math.min(...s.w.values());
  if (span > 70 || span !== dates.length && span - dates.length > 3) continue;
  s.run = []; for (let i = 0; i < span; i++) { const d = new Date(t0 + i * 7 * DAY).toISOString().slice(0, 10); s.run.push(s.w.get(d) ?? null); }
  s.peak = peak; s.weeks = dates.length; s.year = +dates[0].slice(0, 4); s.start = dates[0]; s.peakIdx = s.run.indexOf(peak);
  if (s.title.length > 40 || s.perf.length > 50) continue;
  cands.push(s);
}
const strong = cands.filter((s) => s.peak <= 3 && s.weeks >= 20);
// stratify: cap per year
const byYear = {}; for (const s of strong) (byYear[s.year] ??= []).push(s);
const pool = [];
for (const y of Object.keys(byYear)) { byYear[y].sort((a, b) => b.weeks - a.weeks || a.title.localeCompare(b.title)); pool.push(...byYear[y].slice(0, 3)); }
pool.sort((a, b) => a.start.localeCompare(b.start));
// distractor options: any top-10 song with >=12 weeks
const opts = cands.filter((s) => s.peak <= 10 && s.weeks >= 12);
const id = new Map(); const options = [];
for (const s of [...opts, ...pool]) { const k = s.title + '||' + s.perf; if (id.has(k)) continue; id.set(k, options.length); options.push({ t: s.title, p: s.perf, y: s.year, k: s.peak, w: s.weeks }); }
const puzzles = pool.map((s) => ({ o: id.get(s.title + '||' + s.perf), start: s.start, run: s.run }));
const data = { options, puzzles };
fs.writeFileSync(fileURLToPath(new URL('../data.json', import.meta.url)), JSON.stringify(data));
console.log('puzzles', puzzles.length, 'options', options.length, 'strong', strong.length, fs.statSync(fileURLToPath(new URL('../data.json', import.meta.url))).size);
