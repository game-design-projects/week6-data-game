import fs from 'node:fs';
const out = 'raw/inspections.json';
if (fs.existsSync(out)) { console.log('cached'); process.exit(0); }
const base = 'https://data.cityofnewyork.us/resource/43nn-pn8j.json';
const where = encodeURIComponent("grade in('A','B','C') and inspection_date >= '2024-01-01T00:00:00' and violation_code is not null");
const sel = encodeURIComponent('camis,dba,boro,cuisine_description,inspection_date,violation_code,violation_description,critical_flag,score,grade');
let all = [];
for (let off = 0; ; off += 50000) {
  const r = await fetch(`${base}?$select=${sel}&$where=${where}&$order=camis,inspection_date&$limit=50000&$offset=${off}`, { headers: { 'User-Agent': 'daily-data-class/1.0' } });
  const rows = await r.json();
  console.log(off, rows.length);
  all = all.concat(rows);
  if (rows.length < 50000) break;
  await new Promise((r) => setTimeout(r, 1500));
}
fs.writeFileSync(out, JSON.stringify(all));
