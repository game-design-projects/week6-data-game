import { readFileSync, writeFileSync } from 'node:fs';
const repos = JSON.parse(readFileSync('raw/repos.json'));
const byName = new Map(repos.map((r) => [r.full, r]));
const weeks = []; for (let d = Date.UTC(2023, 1, 6); d < Date.UTC(2024, 4, 27); d += 7 * 864e5) weeks.push(new Date(d).toISOString().slice(0, 10));
const acc = new Map();
for (const line of readFileSync('raw/weekly.tsv', 'utf8').trim().split('\n')) {
  const [n, w, c] = line.split('\t');
  if (!acc.has(n)) acc.set(n, new Array(weeks.length).fill(0));
  const i = weeks.indexOf(w); if (i >= 0) acc.get(n)[i] = +c;
}
const out = [];
for (const [n, s] of acc) {
  const tot = s.reduce((a, b) => a + b, 0);
  if (tot < 3000 || s.filter((x) => x > 0).length < weeks.length - 4) continue; // need full coverage
  const r = byName.get(n);
  out.push({ id: n, name: n, stars: r.stars, lang: r.lang, created: r.created, desc: r.desc, topics: r.topics.slice(0, 6), total: tot, s });
}
out.sort((a, b) => b.stars - a.stars);
writeFileSync('../data.json', JSON.stringify({ weeks, repos: out, asOf: '2026-10' }));
console.log(out.length, 'repos', weeks.length, 'weeks');
