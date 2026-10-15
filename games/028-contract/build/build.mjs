// raw USASpending responses -> data.json (pool of contract awards, by log bucket)
import fs from 'node:fs';
const dir = new URL('./raw/', import.meta.url).pathname;
const seen = new Set(); const ids = new Set(); const out = [];
const bk = (a) => (a < 2e4 ? 0 : a < 1e5 ? 1 : a < 5e5 ? 2 : a < 2e6 ? 3 : a < 1e7 ? 4 : a < 5e7 ? 5 : a < 3e8 ? 6 : 7);
for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('b_')).sort()) {
  const j = JSON.parse(fs.readFileSync(dir + f, 'utf8'));
  const rows = (j.results || []).filter((r) => {
    const d = (r.Description || '').trim();
    const letters = (d.match(/[A-Za-z]/g) || []).length;
    return d.length >= 25 && d.length <= 240 && letters / d.length > 0.6 && /\s/.test(d) && !/\$|TOTAL (OBLIGATED )?(VALUE|COST)/i.test(d) && !seen.has(d.toLowerCase()) && !ids.has(r['Award ID']);
  });
  // prefer civilian agencies so the pool is not almost all DoD: non-DoD rows first, DoD fills the rest
  rows.sort((a, b) => (a['Awarding Agency'] === 'Department of Defense') - (b['Awarding Agency'] === 'Department of Defense'));
  // up to 14 per file, spread evenly through the file
  const civ = rows.filter((r) => r['Awarding Agency'] !== 'Department of Defense');
  const mil = rows.filter((r) => r['Awarding Agency'] === 'Department of Defense');
  const take = [...civ.slice(0, 7), ...mil.filter((_, i) => i % Math.max(1, Math.floor(mil.length / 7)) === 0)].slice(0, 14);
  for (const r of take) {
    if (ids.has(r['Award ID'])) continue; ids.add(r['Award ID']);
    const d = r.Description.trim().replace(/\s+/g, ' ');
    seen.add(r.Description.trim().toLowerCase());
    out.push({ f, id: r['Award ID'], rec: r['Recipient Name'], desc: d,
      amt: Math.round(r['Award Amount']), ag: r['Awarding Agency'], st: r['Place of Performance State Code'] || null,
      naics: r.NAICS?.description || null, psc: r.PSC?.description || null, b: bk(r['Award Amount']), gid: r.generated_internal_id });
  }
}
out.forEach((o) => delete o.f);
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ fetched: '2026-10-15', window: 'FY2025 (2024-10-01 to 2025-09-30)', awards: out }));
const c = {}; out.forEach((o) => (c[o.b] = (c[o.b] || 0) + 1));
console.log(out.length, c, fs.statSync(new URL('../data.json', import.meta.url)).size);
