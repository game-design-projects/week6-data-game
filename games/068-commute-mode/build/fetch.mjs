// Downloads ACS 2019-2023 5-year B08301 (means of transportation to work) + B01003 (population) for every county, state by state,
// via the data.census.gov access API (the api.census.gov endpoint needs a key for bulk queries).
import fs from 'node:fs';
const FIPS = [1,2,4,5,6,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,44,45,46,47,48,49,50,51,53,54,55,56];
fs.mkdirSync('raw', { recursive: true });
for (const t of ['B08301', 'B01003']) for (const f of FIPS) {
  const s = String(f).padStart(2, '0'), out = `raw/${t}-${s}.json`;
  if (fs.existsSync(out) && fs.statSync(out).size > 100) continue;
  const u = `https://data.census.gov/api/access/data/table?id=ACSDT5Y2023.${t}&g=${encodeURIComponent(`0400000US${s}$0500000`)}`;
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 daily-data-games class project' } });
  const txt = await r.text();
  if (r.status !== 200) { console.log('fail', t, s, r.status); continue; }
  fs.writeFileSync(out, txt); console.log('ok', t, s, txt.length);
  await new Promise((r) => setTimeout(r, 700));
}
