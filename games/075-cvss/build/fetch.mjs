// Download NVD CVE 2.0 pages (published windows, CVSS v3 only) into raw/. Cached.
import fs from 'node:fs'; 
const UA = 'daily-data-games-class-project/0.1';
const wins = [['2024-01-01','2024-04-29'],['2024-05-01','2024-08-28'],['2024-09-01','2024-12-29']];
for (const [a,b] of wins) {
  const f = `raw/nvd-${a}.json`; if (fs.existsSync(f)) continue;
  const u = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${a}T00:00:00.000&pubEndDate=${b}T23:59:59.999&cvssV3Severity=HIGH&resultsPerPage=2000`;
  const u2 = u.replace('HIGH','MEDIUM'), u3 = u.replace('HIGH','CRITICAL'), u4 = u.replace('HIGH','LOW');
  const all = [];
  for (const x of [u,u2,u3,u4]) {
    for (let t=0;t<4;t++){ const r = await fetch(x,{headers:{'User-Agent':UA}}); if (r.ok){ const j=await r.json(); all.push(...j.vulnerabilities); console.log(a,x.slice(-60),j.vulnerabilities.length,j.totalResults); break;} console.log('retry',r.status); await new Promise(s=>setTimeout(s,15000)); }
    await new Promise(s=>setTimeout(s,8000));
  }
  fs.writeFileSync(f, JSON.stringify(all));
}
