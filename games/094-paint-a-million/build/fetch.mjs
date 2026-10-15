// Download WorldPop 1km aggregated population rasters (2020) into build/raw/ (cached).
// Also needs raw/cities15000.txt (GeoNames, https://download.geonames.org/export/dump/cities15000.zip) for place names.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'raw');
fs.mkdirSync(dir, { recursive: true });
export const COUNTRIES = ['NLD','BEL','CHE','AUT','PRT','DNK','ISR','LBN','KOR','GHA','KEN','RWA','JOR','ECU','UGA','SEN','CIV','LKA','NPL','PHL','VNM','GRC','HUN','CZE','CHL','CUB','DOM','GTM','TUN','MAR','PER','COL','MYS','KHM','SGP','HKG','TWN','ITA','GBR','EGY','NGA','PAK','BGD','THA','MEX','ARG','TUR','IRN','IRQ','SAU','ZAF','ETH','TZA','AGO','DZA','SDN','SYR','AFG','MMR','UZB','VEN','BOL','CMR','MLI','BFA','SOM','MOZ','ZMB','ZWE','MDG','HTI','SLV','HND','NIC','PAN','CRI','URY','PRY','SRB','ROU','BGR','POL','SWE','NOR','FIN','UKR','BLR','KAZ','AZE','GEO','ARM','KWT','ARE','OMN','YEM','LAO','PRK','MNG','IND','IDN','JPN','FRA','DEU','ESP','BRA','CHN','USA','RUS','CAN','AUS','COD','IRL','ISR','GHA','RWA','JOR','ECU','UGA','LKA','PER','MYS','NGA','BGD','IRQ','SAU','ZAF','ETH','TZA','AGO','DZA','SYR','AFG','VEN','KEN','PHL','CHL'];
const UA = 'daily-data-class/1.0 (NYU assignment)';
if (!fs.existsSync(path.join(dir, 'cities15000.txt'))) {
  execFileSync('curl', ['-sL', '-A', UA, '-o', path.join(dir, 'cities15000.zip'), 'https://download.geonames.org/export/dump/cities15000.zip']);
  execFileSync('unzip', ['-o', '-d', dir, path.join(dir, 'cities15000.zip')]);
}
const get = async (c) => {
  const f = path.join(dir, `${c.toLowerCase()}.tif`);
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) return;
  const url = `https://data.worldpop.org/GIS/Population/Global_2000_2020_1km/2020/${c}/${c.toLowerCase()}_ppp_2020_1km_Aggregated.tif`;
  await new Promise((res) => execFile('curl', ['-sfL', '--retry', '2', '--max-time', '400', '--max-filesize', '60000000', '-A', UA, '-o', f, url], (err) => {
    if (err) { console.log(c, 'failed'); fs.rmSync(f, { force: true }); } else console.log(c, fs.statSync(f).size);
    res();
  }));
};
const queue = [...COUNTRIES];
await Promise.all(Array.from({ length: 2 }, async () => { while (queue.length) { await get(queue.shift()); await new Promise((r) => setTimeout(r, 1500)); } }));
console.log('done');
