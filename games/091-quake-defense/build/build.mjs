// raw USGS geojson -> ../data.json  (pool of real UTC days, same shaping as the live loader)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
import { toPuzzle } from '../game.js';
const g = JSON.parse(fs.readFileSync('raw/usgs-2026-06-01_2026-10-15.json', 'utf8'));
const days = new Set(g.features.map((f) => new Date(f.properties.time).toISOString().slice(0, 10)));
const pool = [...days].sort().map((d) => toPuzzle(g, d)).filter(Boolean);
fs.writeFileSync('../data.json', JSON.stringify({ pool }));
console.log(pool.length, 'days', fs.statSync('../data.json').size, 'bytes');
