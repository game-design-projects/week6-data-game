// Fetch contract awards from USASpending across log-spaced amount buckets and months.
import fs from 'node:fs';
const RAW = new URL('./raw/', import.meta.url).pathname;
fs.mkdirSync(RAW, { recursive: true });
const buckets = [[5e3,2e4],[2e4,1e5],[1e5,5e5],[5e5,2e6],[2e6,1e7],[1e7,5e7],[5e7,3e8],[3e8,3e9]];
const months = [['2024-10-01','2024-12-31'],['2025-01-01','2025-03-31'],['2025-04-01','2025-06-30'],['2025-07-01','2025-09-30']];
for (const [lo, hi] of buckets) for (const [s, e] of months) {
  const f = `${RAW}b_${lo}_${s}.json`;
  if (fs.existsSync(f)) continue;
  const body = { filters: { award_type_codes: ['A','B','C','D'], time_period: [{ start_date: s, end_date: e }], award_amounts: [{ lower_bound: lo, upper_bound: hi }] },
    fields: ['Award ID','Recipient Name','Description','Award Amount','Awarding Agency','Start Date','Place of Performance State Code','NAICS','PSC','generated_internal_id'],
    limit: 100, page: 1, sort: 'Start Date', order: 'desc' };
  const r = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'daily-data-games class project' }, body: JSON.stringify(body) });
  const t = await r.text();
  fs.writeFileSync(f, t);
  console.log(lo, s, r.status, t.length);
  await new Promise((r) => setTimeout(r, 1500));
}
