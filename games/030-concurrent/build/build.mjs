// Step 2: raw steamcharts series (raw/steam/<appid>.json) -> ../data.json
// Each series is ~30 days of roughly hourly "players online" samples. We bucket them into UTC hours, repair
// single-sample dropouts, keep only complete UTC days, store each curve normalised to its own daily peak
// (0-1000) plus the absolute daily peak, then assemble a seeded pool of 5-game puzzles.
import fs from 'node:fs';
import { CANDIDATES } from './apps.mjs';

const MIN_PEAK = 6000;      // below this the hourly curve is too noisy / the game too obscure
const EXCLUDE = new Set([2933620, 3240220 + 0 * 1, 1088710, 24240, 1811260, 1063730, 1948980, 2677660, 1568590, 2878980, 1426210, 346110, 2923300]);
// 3240220 (GTA V Enhanced) is kept below via the rename; the Legacy build (271590) is the one excluded.
EXCLUDE.delete(3240220); EXCLUDE.add(271590);
const RENAME = { 489830: 'Skyrim Special Edition', 3240220: 'Grand Theft Auto V', 1172620: 'Sea of Thieves', 1938090: 'Call of Duty', 2357570: 'Overwatch 2', 1172470: 'Apex Legends', 2215430: "Ghost of Tsushima", 2420110: 'Horizon Forbidden West', 292030: 'The Witcher 3', 289070: 'Civilization VI', 359550: 'Rainbow Six Siege', 578080: 'PUBG: Battlegrounds', 1222670: 'The Sims 4', 2246340: 'Monster Hunter Wilds', 1364780: 'Street Fighter 6', 1229490: 'ULTRAKILL', 1245620: 'Elden Ring', 2073850: 'THE FINALS', 1203220: 'Naraka: Bladepoint', 1778820: 'Tekken 8', 3489700: 'Stellar Blade', 2050650: 'Resident Evil 4', 2399830: 'ARK: Survival Ascended', 4000: "Garry's Mod", 1604030: 'V Rising' };
// Neutral, verifiable one-liners shown after the guess (origin / audience of the game); omitted when unsure.
const NOTE = {
  1203220: 'A multiplayer action game by NetEase; its players are almost all in China.',
  2358720: 'A Chinese single-player action game with a mostly Chinese audience.',
  1599340: 'Developed by Smilegate in Korea; Korean players make up a large share.',
  582660: 'An MMORPG by Pearl Abyss of Korea.',
  216150: 'An MMORPG by Nexon of Korea.',
  227300: 'A European truck simulator, played mostly in Europe.',
  570: 'Players come from Europe, the CIS, Southeast Asia and China.',
  730: 'A global competitive shooter with players on every continent.',
  578080: 'Asian players make up a large share (especially China).',
  1086940: 'A Western single-player RPG, mostly played in Europe and North America.',
  252490: 'A survival server game with a mostly European and North American audience.',
};

fs.mkdirSync('raw/steam', { recursive: true });
const HOUR = 3600e3;
const clean = (s) => s.replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();

/** samples [[ms, count]] -> { 'YYYY-MM-DD': [24 hourly counts] } for complete UTC days only. */
export function dailyCurves(samples) {
  const buckets = new Map();
  for (const [t, v] of samples) {
    if (t % HOUR === 0) continue; // exact-hour stamps are monthly aggregates, not hourly samples
    const k = Math.floor(t / HOUR);
    (buckets.get(k) ?? buckets.set(k, []).get(k)).push(v);
  }
  const hrs = new Map([...buckets].map(([k, a]) => [k, a.reduce((s, x) => s + x, 0) / a.length]));
  // repair isolated dropouts / spikes (Steam occasionally reports a bad sample)
  const fixed = new Map(hrs);
  for (const [k, v] of hrs) {
    const a = hrs.get(k - 1), b = hrs.get(k + 1);
    if (a == null || b == null) continue;
    if (v < Math.min(a, b) * 0.7 || v > Math.max(a, b) * 1.3) fixed.set(k, (a + b) / 2);
  }
  const days = {};
  for (const k of fixed.keys()) {
    const day = new Date(k * HOUR).toISOString().slice(0, 10);
    if (day in days) continue;
    const d0 = Date.parse(day + 'T00:00:00Z') / HOUR;
    const arr = Array.from({ length: 24 }, (_, h) => fixed.get(d0 + h));
    days[day] = arr.every((x) => x != null) ? arr : null;
  }
  return Object.fromEntries(Object.entries(days).filter(([, a]) => a));
}

const games = {};
for (const id of [...new Set(CANDIDATES)]) {
  if (EXCLUDE.has(id)) continue;
  let samples; try { samples = JSON.parse(fs.readFileSync(`raw/steam/${id}.json`, 'utf8')); } catch { continue; }
  if (!samples.length) continue;
  let name = RENAME[id];
  if (!name) { try { name = clean(JSON.parse(fs.readFileSync(`raw/steam/${id}.name.json`, 'utf8'))[id].data.name); } catch { continue; } }
  const days = dailyCurves(samples);
  // days where the series collapses to < 5% of its peak are maintenance windows / feed outages, not player behaviour
  const dates = Object.keys(days).sort().slice(-28).filter((d) => Math.min(...days[d]) >= Math.max(...days[d]) * 0.05);
  const peaks = dates.map((d) => Math.max(...days[d]));
  if (dates.length < 14 || Math.min(...peaks) < MIN_PEAK) { console.log('drop', id, name, Math.min(...peaks)); continue; }
  games[id] = {
    name, note: NOTE[id],
    days: Object.fromEntries(dates.map((d, i) => [d, { p: Math.round(peaks[i]), v: days[d].map((x) => Math.round((x / peaks[i]) * 1000)) }])),
  };
}
const ids = Object.keys(games);
const allDates = [...new Set(ids.flatMap((i) => Object.keys(games[i].days)))].sort();
const commonDates = allDates.filter((d) => ids.every((i) => games[i].days[d]));
console.log('games', ids.length, 'dates', allDates.length, allDates[0], allDates.at(-1));

// ── puzzles ──
let seed = 30;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuf = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dist = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + ((x - b[i]) / 1000) ** 2, 0) / 24);
const peakHour = (v) => v.indexOf(Math.max(...v));
const circ = (a, b) => { const d = Math.abs(a - b) % 24; return Math.min(d, 24 - d); };
// "distinguishable": curve shapes differ clearly, or the popularity (daily peak) differs a lot
const apart = (A, B) => dist(A.v, B.v) >= 0.09 || Math.max(A.p, B.p) / Math.min(A.p, B.p) >= 2 || circ(peakHour(A.v), peakHour(B.v)) >= 3;
const puzzles = []; const seen = new Set();
for (let tries = 0; tries < 200000 && puzzles.length < 90; tries++) {
  const date = allDates[Math.floor(rnd() * allDates.length)];
  const pick = shuf(ids).slice(0, 5);
  if (pick.some((i) => !games[i].days[date])) continue;
  const cs = pick.map((i) => games[i].days[date]);
  // at least two curves must be told apart by shape alone, and every pair by shape or size
  let ok = true, shapeSep = 0;
  for (let i = 0; i < 5 && ok; i++) for (let j = i + 1; j < 5; j++) {
    if (!apart(cs[i], cs[j])) { ok = false; break; }
    if (dist(cs[i].v, cs[j].v) >= 0.09) shapeSep++;
  }
  if (!ok || shapeSep < 6) continue;
  const key = pick.slice().sort().join() + date;
  if (seen.has(key)) continue;
  seen.add(key);
  puzzles.push({ date, ids: pick.map(Number) });
}
// the games table only needs the dates the pool uses
const used = {};
for (const p of puzzles) for (const i of p.ids) (used[i] ??= new Set()).add(p.date);
const outGames = Object.fromEntries(Object.entries(games).filter(([i]) => used[i]).map(([i, g]) => [i, { name: g.name, ...(g.note ? { note: g.note } : {}), days: Object.fromEntries([...used[i]].sort().map((d) => [d, g.days[d]])) }]));
const out = { source: 'steamcharts.com', fetched: allDates.at(-1), games: outGames, puzzles };
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log('puzzles', puzzles.length, 'games used', Object.keys(outGames).length, 'bytes', fs.statSync('../data.json').size);
