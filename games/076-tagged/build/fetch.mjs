// Fetch top-voted Stack Overflow questions from several time windows (Stack Exchange API, no key).
import fs from 'node:fs';
const years = [2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022];
fs.mkdirSync('raw', { recursive: true });
for (const y of years) {
  const f = `raw/so-${y}.json`;
  if (fs.existsSync(f)) continue;
  const from = Date.UTC(y,0,1)/1000, to = Date.UTC(y+1,0,1)/1000;
  const r = await fetch(`https://api.stackexchange.com/2.3/questions?order=desc&sort=votes&site=stackoverflow&pagesize=100&fromdate=${from}&todate=${to}`, { headers: { 'User-Agent': 'dailydata-class/1.0' } });
  fs.writeFileSync(f, JSON.stringify(await r.json()));
  console.log(y, r.status);
  await new Promise((r) => setTimeout(r, 1500));
}
