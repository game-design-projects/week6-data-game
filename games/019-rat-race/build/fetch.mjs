import fs from 'node:fs';
const base = 'https://data.cityofnewyork.us/resource/p937-wjvj.json';
const q = (where) => `${base}?$select=zip_code,date_extract_y(inspection_date) as y,count(*) as n&$where=${encodeURIComponent(where)}&$group=zip_code,y&$limit=50000`;
const jobs = {
  fail: `result like 'Failed for Rat Activity%' AND inspection_date>='2018-01-01'`,
  all: `result in ('Passed','Failed for Other Reason','Failed for Rat Activity','Failed for Rat Activity and Other Reason') AND inspection_date>='2018-01-01'`,
};
for (const [k, w] of Object.entries(jobs)) {
  const f = `raw/${k}.json`;
  if (fs.existsSync(f)) continue;
  const r = await fetch(q(w).replace(/\+/g, '%20'), { headers: { 'User-Agent': 'daily-data-games class project' } });
  fs.writeFileSync(f, await r.text());
  await new Promise((r) => setTimeout(r, 1500));
}
if (!fs.existsSync('raw/boro.json')) {
  const u = `${base}?$select=zip_code,borough,count(*) as n&$group=zip_code,borough&$limit=50000`.replace(/ /g, '%20');
  fs.writeFileSync('raw/boro.json', await (await fetch(u, { headers: { 'User-Agent': 'daily-data-games class project' } })).text());
}
