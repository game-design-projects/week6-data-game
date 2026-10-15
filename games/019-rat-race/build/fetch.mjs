// Downloads monthly rat-inspection counts per zip from NYC Open Data (Socrata SoQL) into build/raw/.
// Run from the build/ directory: node fetch.mjs
import fs from 'node:fs';
const base = 'https://data.cityofnewyork.us/resource/p937-wjvj.json';
const UA = { 'User-Agent': 'daily-data-games class project' };
const url = (sel, where, group) => `${base}?${new URLSearchParams({ $select: sel, ...(where && { $where: where }), $group: group, $limit: '50000' })}`;
const jobs = {
  fail_m: url('zip_code,date_trunc_ym(inspection_date) as m,count(*) as n', `result like 'Failed for Rat Activity%' AND inspection_date>='2018-01-01'`, 'zip_code,m'),
  all_m: url('zip_code,date_trunc_ym(inspection_date) as m,count(*) as n', `result in ('Passed','Failed for Other Reason','Failed for Rat Activity','Failed for Rat Activity and Other Reason') AND inspection_date>='2018-01-01'`, 'zip_code,m'),
  boro: url('zip_code,borough,count(*) as n', '', 'zip_code,borough'),
};
fs.mkdirSync('raw', { recursive: true });
for (const [k, u] of Object.entries(jobs)) {
  const f = `raw/${k}.json`;
  if (fs.existsSync(f)) continue;
  const r = await fetch(u, { headers: UA });
  if (!r.ok) throw new Error(`${k}: HTTP ${r.status}`);
  fs.writeFileSync(f, await r.text());
  console.log('saved', f);
  await new Promise((r) => setTimeout(r, 1500));
}
