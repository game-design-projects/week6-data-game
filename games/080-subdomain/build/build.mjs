import fs from 'node:fs'; import companies from './companies.mjs';
const MAX_LABELS = 36, MIN_LABELS = 24;
const ok = (l) => /^[a-z][a-z0-9-]{1,22}[a-z0-9]$/.test(l) && !/\d{4,}/.test(l) && (l.match(/\d/g) || []).length <= 2 && !/[a-f0-9]{8,}/.test(l.replace(/-/g, ''));
const rows = [];
for (const [domain, name, cat] of companies) {
  const f = `raw/${domain}.json`; if (!fs.existsSync(f)) continue;
  const brand = domain.split('.')[0];
  const lab = new Map(); // prefix -> latest not_before
  for (const e of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    for (const n of String(e.name_value).split('\n')) {
      const h = n.trim().toLowerCase().replace(/^\*\./, '');
      if (!h.endsWith('.' + domain)) continue;
      const pre = h.slice(0, -domain.length - 1);
      if (!pre || pre.includes('*')) continue;
      const first = pre.split('.').pop(); // label directly under the domain
      if (!ok(first)) continue;
      if (first.includes(brand) || first.includes(name.toLowerCase().replace(/[^a-z0-9]/g, ''))) continue;
      const d = (e.not_before || '').slice(0, 10);
      if (!lab.has(first) || lab.get(first) < d) lab.set(first, d);
    }
  }
  if (lab.size >= MIN_LABELS) rows.push({ domain, name, cat, lab });
}
// label frequency across companies = how generic a label is
const freq = new Map();
for (const r of rows) for (const l of r.lab.keys()) freq.set(l, (freq.get(l) || 0) + 1);
const companiesOut = rows.map((r) => {
  const all = [...r.lab.entries()].map(([l, d]) => ({ l, d, f: freq.get(l) }));
  // generic first (informative of "type of org"), unique last; within a tier prefer recent
  const unique = all.filter((x) => x.f === 1).sort((a, b) => b.d.localeCompare(a.d));
  const shared = all.filter((x) => x.f > 1).sort((a, b) => b.f - a.f || b.d.localeCompare(a.d));
  const pick = [...shared.slice(0, 18), ...unique.slice(0, MAX_LABELS - Math.min(18, shared.length))].slice(0, MAX_LABELS);
  const latest = pick.map((x) => x.d).sort().pop();
  return { id: r.domain.split('.')[0], name: r.name, cat: r.cat, domain: r.domain, total: r.lab.size, latest, labels: pick.map((x) => x.l) };
});
const out = { fetched: new Date().toISOString().slice(0, 10), companies: companiesOut };
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log(companiesOut.length, 'companies', fs.statSync('../data.json').size, 'bytes');
