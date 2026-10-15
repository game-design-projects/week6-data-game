// Downloads raw inputs into build/raw/ (cached; delete a file to refetch). Run from build/: node fetch.mjs
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
fs.mkdirSync('raw', { recursive: true });
const UA = 'daily-data-games/072-garage (class project)';
if (!fs.existsSync('raw/county_make.json')) {
  const q = "$select=county,make,count(*) as n&$where=record_type='VEH' and registration_class='PAS'&$group=county,make&$limit=50000";
  const url = 'https://data.ny.gov/resource/w4pv-hbkt.json?' + encodeURI(q).replace(/'/g, '%27').replace(/&/g, '&');
  execFileSync('curl', ['-sSf', '-A', UA, '--max-time', '300', '-o', 'raw/county_make.json', url]);
  console.log('fetched county_make.json');
}
if (!fs.existsSync('raw/2023_Gaz_counties_national.txt')) {
  execFileSync('curl', ['-sSf', '-A', UA, '-o', 'raw/gaz.zip', 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_counties_national.zip']);
  execFileSync('unzip', ['-o', '-d', 'raw', 'raw/gaz.zip']);
}
