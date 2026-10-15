// Build data.json: BGG metadata (TidyTuesday 2022-01-25 mirror of BGG) + live average weight from BGG's geekdo JSON.
import fs from 'node:fs';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const raw = path.join(dir, 'raw');
const UA = 'daily-data-class/1.0 (NYU class project)';
const BASE = 'https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2022/2022-01-25/';
const N = Number(process.env.N || 260);

async function cached(file, url) {
  const p = path.join(raw, file);
  if (fs.existsSync(p) && fs.statSync(p).size > 20) return fs.readFileSync(p, 'utf8');
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const t = await r.text();
  fs.writeFileSync(p, t);
  await new Promise((s) => setTimeout(s, 700));
  return t;
}

import { parseCSV, list, ent } from './lib.mjs';

if (!fs.existsSync(raw)) fs.mkdirSync(raw, { recursive: true });
const ratings = parseCSV(await cached('ratings.csv', BASE + 'ratings.csv'));
const details = new Map(parseCSV(await cached('details.csv', BASE + 'details.csv')).map((d) => [d.id, d]));
const top = ratings.filter((r) => details.has(r.id)).sort((a, b) => b.users_rated - a.users_rated).slice(0, N);

const games = [];
for (const r of top) {
  const d = details.get(r.id);
  let w;
  try { w = JSON.parse(await cached(`dyn-${r.id}.json`, `https://api.geekdo.com/api/dynamicinfo?objectid=${r.id}&objecttype=thing`)).item; } catch (e) { console.warn('skip', r.id, e.message); continue; }
  const weight = Number(w.stats?.avgweight), votes = Number(w.stats?.numweights);
  if (!(weight > 1 && weight <= 5) || votes < 150) continue;
  if (!(Number(d.playingtime) > 0) || !(Number(d.minplayers) > 0)) continue; // e.g. Chess has playingtime 0
  const desc = ent(d.description || '');
  if (desc.length < 120) continue;
  games.push({
    id: Number(r.id), name: r.name, year: Number(d.yearpublished), weight: +weight.toFixed(2), votes,
    rating: +Number(r.average).toFixed(2), rank: Number(r.rank), rated: Number(r.users_rated),
    minp: Number(d.minplayers), maxp: Number(d.maxplayers), time: Number(d.playingtime), age: Number(d.minage),
    cats: list(d.boardgamecategory).slice(0, 4), mechs: list(d.boardgamemechanic).slice(0, 6),
    desc: desc.length > 420 ? desc.slice(0, desc.lastIndexOf(' ', 420)) + '…' : desc,
  });
}
fs.writeFileSync(path.join(dir, '..', 'data.json'), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), games }));
console.log(games.length, 'games');
