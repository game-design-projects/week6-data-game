// Per place x iconic group weekly totals (effort baseline).
import fs from 'node:fs'; import path from 'node:path';
const RAW = new URL('./raw/', import.meta.url).pathname;
const UA = { 'User-Agent': 'daily-data-games/1.0 (NYU class project; phenology game)' };
const PLACES = { US: 1, CA: 6712, GB: 6857, AU: 6744, NZ: 6803 };
const GROUPS = ['Aves', 'Insecta', 'Plantae', 'Fungi', 'Reptilia', 'Amphibia', 'Mammalia'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [cc, pid] of Object.entries(PLACES)) for (const g of GROUPS) {
  const f = path.join(RAW, `tot_${cc}_${g}.json`);
  if (fs.existsSync(f)) continue;
  for (let i = 0; i < 4; i++) {
    let r; try { r = await fetch(`https://api.inaturalist.org/v1/observations/histogram?iconic_taxa=${g}&place_id=${pid}&date_field=observed&interval=week_of_year&quality_grade=research`, { headers: UA }); } catch { await sleep(5000); continue; }
    if (r.ok) { fs.writeFileSync(f, await r.text()); await sleep(900); break; }
    await sleep(4000 * (i + 1));
  }
}
console.log('done tot');
