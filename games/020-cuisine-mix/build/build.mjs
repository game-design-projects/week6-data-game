// raw camis.json (one row per restaurant) -> data.json (per-ZIP cuisine mix + citywide share of every cuisine)
import { readFileSync, writeFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync(new URL('./raw/camis.json', import.meta.url)));
const MERGE = {
  'Latin American': 'Latin Amer.',
  'Bakery Products/Desserts': 'Bakery/Dessert',
  'Sandwiches/Salads/Mixed Buffet': 'Sandwiches/Salads', 'Soups/Salads/Sandwiches': 'Sandwiches/Salads', Salads: 'Sandwiches/Salads', Sandwiches: 'Sandwiches/Salads',
  'Juice, Smoothies, Fruit Salads': 'Juice/Smoothies',
  'Hotdogs/Pretzels': 'Hotdogs', 'Creole/Cajun': 'Creole', Cajun: 'Creole',
};
const DROP = new Set(['Other', 'Not Listed/Not Applicable']); // uninformative labels
const short = (c) => { const s = c.replace(/ \(.*\)/, ''); return MERGE[s] ?? s; };
const MIN_N = 100;
const zips = new Map(); const city = new Map(); let N = 0;
for (const r of rows) {
  const lat = +r.lat, lng = +r.lng;
  if (!r.zip || !/^1\d{4}$/.test(r.zip) || !r.cuisine || DROP.has(r.cuisine) || !(lat > 40.4 && lat < 41 && lng < -73.6 && lng > -74.3)) continue;
  const c = short(r.cuisine); N++;
  city.set(c, (city.get(c) || 0) + 1);
  const z = zips.get(r.zip) || { zip: r.zip, boro: r.boro, n: 0, lats: [], lngs: [], cu: new Map() };
  z.n++; z.lats.push(lat); z.lngs.push(lng); z.cu.set(c, (z.cu.get(c) || 0) + 1); zips.set(r.zip, z);
}
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const out = [];
for (const z of [...zips.values()].sort((a, b) => a.zip.localeCompare(b.zip))) {
  if (z.n < MIN_N) continue;
  const mix = [...z.cu].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lift = mix.filter(([, v]) => v >= 8).map(([k, v]) => [k, +(v / z.n / (city.get(k) / N)).toFixed(1), v]).filter(([, l]) => l >= 1.5).sort((a, b) => b[1] - a[1]).slice(0, 3);
  out.push({ zip: z.zip, boro: z.boro, n: z.n, lat: +med(z.lats).toFixed(4), lng: +med(z.lngs).toFixed(4), mix: mix.slice(0, 10), lift });
}
const cityShare = Object.fromEntries([...city].filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(100 * v / N).toFixed(3)]));
writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ n: N, cityShare, zips: out }));
console.log(N, out.length, Object.keys(cityShare).length);
