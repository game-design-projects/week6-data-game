// Fetch geotagged street-scene candidates from Wikimedia Commons around world cities.
import fs from 'node:fs'; import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const raw = path.join(dir, 'raw'); fs.mkdirSync(raw, { recursive: true });
const CITIES = [
['Reykjavik',64.147,-21.94],['Oslo',59.91,10.75],['London',51.51,-0.13],['Paris',48.86,2.35],['Lisbon',38.72,-9.14],['Madrid',40.42,-3.70],
['Rome',41.90,12.50],['Athens',37.98,23.73],['Istanbul',41.01,28.98],['Moscow',55.76,37.62],['Warsaw',52.23,21.01],['Prague',50.08,14.42],
['Cairo',30.04,31.24],['Marrakesh',31.63,-7.99],['Lagos',6.52,3.38],['Nairobi',-1.29,36.82],['Cape Town',-33.92,18.42],['Addis Ababa',9.03,38.74],
['Dubai',25.20,55.27],['Tehran',35.69,51.39],['Mumbai',19.08,72.88],['Delhi',28.61,77.21],['Kathmandu',27.71,85.32],['Dhaka',23.81,90.41],
['Bangkok',13.76,100.50],['Hanoi',21.03,105.85],['Jakarta',-6.21,106.85],['Manila',14.60,120.98],['Hong Kong',22.32,114.17],['Shanghai',31.23,121.47],
['Beijing',39.90,116.40],['Seoul',37.57,126.98],['Tokyo',35.68,139.69],['Osaka',34.69,135.50],['Ulaanbaatar',47.92,106.92],['Almaty',43.24,76.89],
['Sydney',-33.87,151.21],['Auckland',-36.85,174.76],['Honolulu',21.31,-157.86],['Vancouver',49.28,-123.12],['San Francisco',37.77,-122.42],['Los Angeles',34.05,-118.24],
['Mexico City',19.43,-99.13],['Havana',23.11,-82.37],['New York',40.71,-74.01],['Chicago',41.88,-87.63],['Toronto',43.65,-79.38],['Bogota',4.71,-74.07],
['Lima',-12.05,-77.04],['Sao Paulo',-23.55,-46.63],['Buenos Aires',-34.60,-58.38],['Santiago',-33.45,-70.67],['Quito',-0.18,-78.47],['La Paz',-16.50,-68.15],
['Dakar',14.72,-17.47],['Tbilisi',41.72,44.79],['Yerevan',40.18,44.51],['Tallinn',59.44,24.75],['Edinburgh',55.95,-3.19],['Anchorage',61.22,-149.90],
['Tashkent',41.30,69.24],['Colombo',6.93,79.86],['Singapore',1.35,103.82],['Phnom Penh',11.56,104.92],['Taipei',25.03,121.57],['Kyiv',50.45,30.52],
['Budapest',47.50,19.04],['Vienna',48.21,16.37],['Berlin',52.52,13.40],['Amsterdam',52.37,4.90],['Accra',5.60,-0.19],['Tunis',36.81,10.18],['Montreal',45.50,-73.57],['Panama City',8.98,-79.52],
];
const UA = 'daily-data-games-class-project/1.0 (student project; contact lishuyustevenli@gmail.com)';
for (const [name, lat, lon] of CITIES) {
  const f = path.join(raw, name.replace(/\W/g, '_') + '.json');
  if (fs.existsSync(f)) continue;
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ action: 'query', format: 'json', generator: 'geosearch', ggscoord: `${lat}|${lon}`, ggsradius: 6000, ggsnamespace: 6, ggslimit: 50,
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
  fs.writeFileSync(f, txt); console.log(name, 'ok');
  await new Promise((s) => setTimeout(s, 2500));
}
