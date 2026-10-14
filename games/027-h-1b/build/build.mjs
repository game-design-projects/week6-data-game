// raw/*.html (h1bdata.info mirror of DOL LCA disclosure) -> ../data.json
import fs from 'node:fs';
const rows = [];
for (const f of fs.readdirSync('raw').filter((x) => x.endsWith('.html'))) {
  const [job, city] = f.replace('.html', '').split('__').map((s) => s.replace(/_/g, ' '));
  const html = fs.readFileSync('raw/' + f, 'utf8');
  for (const m of html.matchAll(/<tr><td><a [^>]*>([^<]+)<\/a><\/td><td><a [^>]*>([^<]+)<\/a><\/td><td><a href="details\.php\?id=([^"]+)"[^>]*>([\d,]+)<\/a><\/td><td><a [^>]*>([^<]+)<\/a><\/td><td[^>]*>([\d/]+)<\/td>/g)) {
    const sal = +m[4].replace(/,/g, '');
    const loc = m[5].replace(/&amp;/g, '&');
    if (!loc.startsWith(city + ',')) continue; // keep exact city only
    rows.push({ q: job, city, emp: m[1].replace(/&amp;/g, '&'), title: m[2].replace(/&amp;/g, '&'), id: m[3], sal, date: m[6] });
  }
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const cells = {};
const byCell = {};
for (const r of rows) {
  if (r.sal < 25000 || r.sal > 700000) continue;
  (byCell[r.q + '|' + r.city] ||= []).push(r);
}
for (const [k, v] of Object.entries(byCell)) {
  if (v.length < 8) continue;
  const [q, city] = k.split('|');
  const s = v.map((x) => x.sal);
  (cells[q] ||= {})[city] = { n: v.length, med: med(s), p25: [...s].sort((a, b) => a - b)[Math.floor(s.length * 0.25)], p75: [...s].sort((a, b) => a - b)[Math.floor(s.length * 0.75)] };
}
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const puzzles = [];
for (const [k, v] of Object.entries(byCell)) {
  const [q, city] = k.split('|');
  if (!cells[q]?.[city]) continue;
  const seen = new Set();
  const cand = v.filter((x) => x.title.length < 48 && !seen.has(x.emp) && seen.add(x.emp))
    .sort((a, b) => hash(a.id) - hash(b.id)).slice(0, 5);
  for (const x of cand) puzzles.push({ q, city, emp: x.emp, title: x.title, id: x.id, sal: x.sal, date: x.date });
}
puzzles.sort((a, b) => hash(a.id) - hash(b.id));
const out = { year: 2024, nRows: rows.length, cells, puzzles: puzzles.slice(0, 220) };
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log(rows.length, 'rows', Object.keys(byCell).length, 'cells', out.puzzles.length, 'puzzles', fs.statSync('../data.json').size, 'bytes');
