// Fetch top-voted Stack Overflow questions per year, pages 1-4 (Stack Exchange API, no key).
// Cached in raw/: page 1 = so-YYYY.json (legacy name), pages 2+ = so-YYYY-pN.json.
import fs from 'node:fs';
const years = [2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022];
const PAGES = 4;
fs.mkdirSync('raw', { recursive: true });
for (const y of years) {
  for (let p = 1; p <= PAGES; p++) {
    const f = p === 1 ? `raw/so-${y}.json` : `raw/so-${y}-p${p}.json`;
    if (fs.existsSync(f)) continue;
    const from = Date.UTC(y, 0, 1) / 1000, to = Date.UTC(y + 1, 0, 1) / 1000;
    const url = `https://api.stackexchange.com/2.3/questions?order=desc&sort=votes&site=stackoverflow&pagesize=100&page=${p}&fromdate=${from}&todate=${to}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'dailydata-class/1.0 (NYU class project)' } });
    const j = await r.json();
    fs.writeFileSync(f, JSON.stringify(j));   // save raw before anything else
    console.log(y, p, r.status, j.items?.length, 'quota', j.quota_remaining);
    if (r.status !== 200) process.exit(1);
    await new Promise((s) => setTimeout(s, (j.backoff ?? 0) * 1000 + 1500));
  }
}
