// Fetch LCA (H-1B) filings per job x city from h1bdata.info (a mirror of DOL OFLC LCA disclosure data). Cached to raw/.
import fs from 'node:fs';
const YEAR = 2024;
const JOBS = ['SOFTWARE ENGINEER','DATA SCIENTIST','DATA ENGINEER','FINANCIAL ANALYST','MECHANICAL ENGINEER','PRODUCT MANAGER','BUSINESS ANALYST','ACCOUNTANT','HOSPITALIST','RESEARCH SCIENTIST','ASSISTANT PROFESSOR','MACHINE LEARNING ENGINEER','ELECTRICAL ENGINEER','UX DESIGNER','QUALITY ASSURANCE ENGINEER','PHARMACIST','CIVIL ENGINEER','MARKETING MANAGER'];
const CITIES = ['SAN FRANCISCO','NEW YORK','SEATTLE','AUSTIN','CHICAGO','BOSTON','ATLANTA','DALLAS','HOUSTON','SAN JOSE','LOS ANGELES','DENVER'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const job of JOBS) for (const city of CITIES) {
  const f = `raw/${job.replace(/ /g, '_')}__${city.replace(/ /g, '_')}__${YEAR}.html`;
  if (fs.existsSync(f)) continue;
  const url = `https://h1bdata.info/index.php?em=&job=${encodeURIComponent(job).replace(/%20/g, '+')}&city=${encodeURIComponent(city).replace(/%20/g, '+')}&year=${YEAR}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (class project: daily data games)' } });
    fs.writeFileSync(f, await r.text());
    console.log(r.status, job, city);
  } catch (e) { console.log('ERR', job, city, e.message); }
  await sleep(1500);
}
