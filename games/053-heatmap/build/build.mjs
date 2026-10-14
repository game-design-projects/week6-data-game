// Build data.json from IMDb non-commercial datasets (raw gz in build/raw/).
import { createReadStream, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

const lines = (f) => createInterface({ input: createReadStream(new URL(`./raw/${f}.tsv.gz`, import.meta.url)).pipe(createGunzip()) });

// 1. ratings
const rating = new Map();
for await (const l of lines('title.ratings')) { const [id, r, v] = l.split('\t'); if (id !== 'tconst') rating.set(id, [+r, +v]); }

// 2. episodes -> parent
const eps = new Map(); // parent -> [{id,s,e}]
for await (const l of lines('title.episode')) {
  const [id, parent, s, e] = l.split('\t');
  if (s === '\\N' || e === '\\N' || !rating.has(id) || !rating.has(parent)) continue;
  if (!eps.has(parent)) eps.set(parent, []);
  eps.get(parent).push({ id, s: +s, e: +e });
}

// candidate shows: popular, >= 2 seasons, >= 20 rated episodes
const cand = [...eps.entries()].map(([p, list]) => ({ p, list, v: rating.get(p)[1] }))
  .filter((x) => x.list.length >= 20 && new Set(x.list.map((e) => e.s)).size >= 2 && x.v >= 150000)
  .sort((a, b) => b.v - a.v);
const want = new Set(cand.map((c) => c.p));
for (const c of cand) for (const e of c.list) want.add(e.id);

// 3. basics for those
const info = new Map();
for await (const l of lines('title.basics')) {
  const f = l.split('\t');
  if (!want.has(f[0])) continue;
  info.set(f[0], { type: f[1], title: f[2], start: f[5], end: f[6], genres: f[8] });
}

const shows = [];
for (const c of cand) {
  const b = info.get(c.p);
  if (!b || b.type !== 'tvSeries') continue;
  const rows = c.list.map((e) => ({ s: e.s, e: e.e, r: rating.get(e.id)[0], v: rating.get(e.id)[1], t: info.get(e.id)?.title || '' }))
    .filter((e) => e.v >= 50);
  if (rows.length < 20) continue;
  const seasons = [...new Set(rows.map((e) => e.s))].sort((a, b) => a - b);
  if (seasons.length < 2 || seasons.length > 20) continue;
  rows.sort((a, b) => a.s - b.s || a.e - b.e);
  shows.push({
    id: c.p, title: b.title, start: +b.start, end: b.end === '\\N' ? null : +b.end,
    genres: b.genres.split(',').filter((g) => g !== '\\N' && g !== 'Drama').slice(0, 3).concat(b.genres.includes('Drama') ? ['Drama'] : []).slice(0, 3),
    rating: rating.get(c.p)[0], votes: c.v,
    eps: rows.map((e) => [e.s, e.e, e.r, e.t]),
  });
  if (shows.length >= 120) break;
}
const out = { source: 'IMDb non-commercial datasets (title.basics / title.episode / title.ratings), snapshot ' + new Date().toISOString().slice(0, 10), shows };
writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log(shows.length, 'shows', shows.slice(0, 5).map((s) => s.title + ' ' + s.eps.length));
