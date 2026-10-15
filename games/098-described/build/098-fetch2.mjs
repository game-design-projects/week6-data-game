// Second geosearch pass: cities that yielded no candidate in pass 1, wider radius (10 km), up to 100 files.
import fs from 'node:fs'; import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const raw = path.join(dir, 'raw'); fs.mkdirSync(raw, { recursive: true });
const CITIES = [['Accra',5.60,-0.19],['Amsterdam',52.37,4.90],['Anchorage',61.22,-149.90],['Bangkok',13.76,100.50],['Berlin',52.52,13.40],['Bogota',4.71,-74.07],['Chicago',41.88,-87.63],['Havana',23.11,-82.37],['Lima',-12.05,-77.04],['Madrid',40.42,-3.70],['Mumbai',19.08,72.88],['Osaka',34.69,135.50],['Panama City',8.98,-79.52],['Paris',48.86,2.35],['Rome',41.90,12.50],['Santiago',-33.45,-70.67],['Sao Paulo',-23.55,-46.63],['Seoul',37.57,126.98],['Singapore',1.35,103.82],['Tehran',35.69,51.39],['Budapest',47.50,19.04],['Vienna',48.21,16.37],['Bucharest',44.43,26.10],['Hyderabad',17.39,78.49],['Kolkata',22.57,88.36],['Yangon',16.84,96.17],['Vientiane',17.97,102.60],['Cusco',-13.52,-71.97],['Montevideo',-34.90,-56.16],['Caracas',10.49,-66.88],['Kigali',-1.95,30.06],['Zanzibar',-6.16,39.19],['Muscat',23.59,58.41],['Jerusalem',31.78,35.22],['Baku',40.41,49.87],['Minsk',53.90,27.57],['Sarajevo',43.86,18.41],['Zagreb',45.81,15.98],['Helsinki',60.17,24.94],['Valletta',35.90,14.51]];
const UA = 'daily-data-games-class-project/1.0 (student project; contact lishuyustevenli@gmail.com)';
for (const [name, lat, lon] of CITIES) {
  const f = path.join(raw, 'r2_' + name.replace(/\W/g, '_') + '.json');
  if (fs.existsSync(f)) continue;
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ action: 'query', format: 'json', generator: 'geosearch', ggscoord: `${lat}|${lon}`, ggsradius: 10000, ggsnamespace: 6, ggslimit: 100,
    prop: 'imageinfo|categories|coordinates', iiprop: 'url|size|mime|extmetadata', iiurlwidth: 640, iiextmetadatafilter: 'Artist|LicenseShortName|ImageDescription', cllimit: 'max', colimit: 'max' })
    .forEach(([k, v]) => u.searchParams.set(k, v));
  let txt = '';
  for (let a = 0; a < 5; a++) {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    txt = await r.text();
    if (txt.startsWith('{')) break;
    await new Promise((s) => setTimeout(s, 8000 * (a + 1)));
  }
  if (!txt.startsWith('{')) { console.log(name, 'FAILED'); continue; }
  fs.writeFileSync(f, txt); console.log(name, 'ok', Object.keys(JSON.parse(txt).query?.pages ?? {}).length);
  await new Promise((s) => setTimeout(s, 2500));
}
