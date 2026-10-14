import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync('raw/inspections.json', 'utf8'));
const g = new Map();
for (const r of rows) {
  const k = r.camis + '|' + r.inspection_date;
  if (!g.has(k)) g.set(k, []);
  g.get(k).push(r);
}
const clean = (s) => s.replace(/\s+/g, ' ').replace(/ /g, ' ').trim();
const out = [];
const stat = {};
for (const [k, v] of g) {
  const n = v.length;
  const grade = v[0].grade, score = Number(v[0].score);
  if (!Number.isFinite(score)) continue;
  const key = grade + n; stat[key] = (stat[key] || 0) + 1;
  if (n !== 3) continue;
  if ((grade === 'A') !== (score <= 13) || (grade === 'C') !== (score >= 28)) continue;
  out.push({ id: k, name: v[0].dba, boro: v[0].boro, cuisine: v[0].cuisine_description, date: v[0].inspection_date.slice(0, 10), score, grade,
    v: v.map((x) => ({ code: x.violation_code, text: clean(x.violation_description), crit: x.critical_flag === 'Critical' })) });
}
console.log(stat, out.length);
// balance: sample per grade
const by = { A: [], B: [], C: [] };
for (const o of out) by[o.grade].push(o);
for (const k in by) console.log(k, by[k].length);
// deterministic sample
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const sh = (a) => a.map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const pool = [...sh(by.A).slice(0, 100), ...sh(by.B).slice(0, 80), ...sh(by.C).slice(0, 70)];
fs.writeFileSync('../data.json', JSON.stringify({ items: pool.map(({ id, ...r }) => r) }));
console.log(pool.length, fs.statSync('../data.json').size);
