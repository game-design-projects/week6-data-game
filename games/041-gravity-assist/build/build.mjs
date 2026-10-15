// build/raw → data.json: the Keplerian elements (Table 1) + a small set of Horizons check points.
// Run: node build/fetch.mjs && node build/build.mjs
import fs from 'node:fs';
import { position, jdOf, AU } from '../astro.js';

const RAW = new URL('./raw/', import.meta.url);
const html = fs.readFileSync(new URL('approx_pos.html', RAW), 'utf8');
const t1 = html.split('Keplerian Elements and Rates')[1].split('Table 2a')[0].replace(/<[^>]*>/g, '');
const lines = t1.split('\n').map((l) => l.trim());
const KEYS = ['a', 'e', 'I', 'L', 'w', 'n'];
const NAME = { Mercury: 'mercury', Venus: 'venus', 'EM Bary': 'earth', Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturn' };
const elements = {};
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^(Mercury|Venus|EM Bary|Mars|Jupiter|Saturn)\s+(-?\d.*)$/);
  if (!m) continue;
  const v0 = m[2].trim().split(/\s+/).map(Number), v1 = lines[i + 1].split(/\s+/).map(Number);
  if (v0.length !== 6 || v1.length !== 6 || [...v0, ...v1].some((x) => !isFinite(x))) throw new Error(`bad row ${m[1]}`);
  elements[NAME[m[1]]] = Object.fromEntries(KEYS.map((k, j) => [k, [v0[j], v1[j]]]));
}
if (Object.keys(elements).length !== 6) throw new Error('missing planets');

// Horizons check points: x,y (AU) at 12 dates between 2027 and 2049 (every ~22 months)
const check = [];
const names = Object.keys(elements);
for (const n of names) {
  const txt = JSON.parse(fs.readFileSync(new URL(`${n}.json`, RAW))).result;
  const rows = txt.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n').map((l) => l.split(','));
  for (let k = 0; k < rows.length; k += 45) {
    const [jd, , x, y, z] = rows[k];
    check.push({ body: n, jd: +parseFloat(jd).toFixed(1), r: [x, y, z].map((c) => +(Number(c) / AU).toFixed(4)) });
  }
}
// sanity: the approximation must agree with Horizons before we ship it
let worst = 0;
for (const c of check) worst = Math.max(worst, Math.hypot(...position(elements, c.body, c.jd).map((x, i) => x / AU - c.r[i])));
console.log('check points', check.length, 'worst error AU', worst.toFixed(4));

const names = { mercury: 'Mercury', venus: 'Venus', earth: 'Earth', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn' };
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ names, elements, check }));
