// raw USASpending responses -> data.json (pool of contract awards, by log bucket)
import fs from 'node:fs';
const dir = new URL('./raw/', import.meta.url).pathname;
const seen = new Set(); const out = [];
const bk = (a) => (a < 2e4 ? 0 : a < 1e5 ? 1 : a < 5e5 ? 2 : a < 2e6 ? 3 : a < 1e7 ? 4 : a < 5e7 ? 5 : a < 3e8 ? 6 : 7);
for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('b_')).sort()) {
  const j = JSON.parse(fs.readFileSync(dir + f, 'utf8'));
  const rows = (j.results || []).filter((r) => {
    const d = (r.Description || '').trim();
    const letters = (d.match(/[A-Za-z]/g) || []).length;
    return d.length >= 25 && letters / d.length > 0.6 && /\s/.test(d) && !seen.has(d.toLowerCase());
  });
  // up to 14 per file, spread evenly through the file
  const step = Math.max(1, Math.floor(rows.length / 14));
  for (let i = 0; i < rows.length && out.filter((o) => o.f === f).length < 14; i += step) {
    const r = rows[i]; const d = r.Description.trim().replace(/\s+/g, ' ');
    seen.add(r.Description.trim().toLowerCase());
    out.push({ f, id: r['Award ID'], rec: r['Recipient Name'], desc: d.length > 240 ? d.slice(0, 237) + '…' : d,
      amt: Math.round(r['Award Amount']), ag: r['Awarding Agency'], date: r['Start Date'], st: r['Place of Performance State Code'] || null,
      naics: r.NAICS?.description || null, psc: r.PSC?.description || null, b: bk(r['Award Amount']), gid: r.generated_internal_id });
  }
}
out.forEach((o) => delete o.f);
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ fetched: '2026-10-14', awards: out }));
const c = {}; out.forEach((o) => (c[o.b] = (c[o.b] || 0) + 1));
console.log(out.length, c, fs.statSync(new URL('../data.json', import.meta.url)).size);
