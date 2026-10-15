// Download NVD CVE API 2.0 pages (CVSS v3 only), 3 publish windows covering 2024, paged with startIndex.
// Every page is cached in raw/ before parsing; re-runs only fetch what is missing. Public rate limit: 5 req / 30 s.
import fs from 'node:fs';
const UA = 'daily-data-games-class-project/0.2 (NYU course)';
const WINS = [['2024-01-01', '2024-04-29'], ['2024-04-30', '2024-08-27'], ['2024-08-28', '2024-12-25']];
const SEVS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const PAGE = 2000;
fs.mkdirSync('raw', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [a, b] of WINS) for (const sev of SEVS) {
  for (let idx = 0; ; idx += PAGE) {
    const f = `raw/p-${a}-${sev}-${idx}.json`;
    let total;
    if (fs.existsSync(f)) { total = JSON.parse(fs.readFileSync(f)).totalResults; }
    else {
      const u = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${a}T00:00:00.000&pubEndDate=${b}T23:59:59.999&cvssV3Severity=${sev}&resultsPerPage=${PAGE}&startIndex=${idx}`;
      let ok = false;
      for (let t = 0; t < 6 && !ok; t++) {
        try {
          const r = await fetch(u, { headers: { 'User-Agent': UA } });
          if (r.ok) { const txt = await r.text(); JSON.parse(txt); fs.writeFileSync(f, txt); total = JSON.parse(txt).totalResults; ok = true; console.log(a, sev, idx, '/', total); }
          else { console.log('retry', r.status); await sleep(20000); }
        } catch (e) { console.log('err', e.message); await sleep(20000); }
      }
      if (!ok) throw new Error('giving up ' + u);
      await sleep(7000);
    }
    if (idx + PAGE >= total) break;
  }
}
console.log('done');
