// raw day files -> data.json (uses the same toDay() as the live loader) and a small test fixture.
import fs from 'node:fs';
import { toDay } from '../game.js';
const RAW = new URL('./raw/', import.meta.url).pathname;
const days = [];
for (const f of fs.readdirSync(RAW).filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) {
  const d = toDay(JSON.parse(fs.readFileSync(RAW + f, 'utf8')), f.slice(0, 10));
  if (d) days.push(d);
}
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ days }));
console.log(days.length, 'days');
// fixture: one raw day trimmed to the fields the API returns for apiUrl()
const keep = ['title', 'url', 'points', 'num_comments', 'created_at_i', 'objectID'];
const f0 = fs.readdirSync(RAW).filter((x) => x.endsWith('.json')).sort().at(-1);
const raw = JSON.parse(fs.readFileSync(RAW + f0, 'utf8'));
const hits = raw.hits.map((h) => Object.fromEntries(keep.map((k) => [k, h[k]])));
fs.writeFileSync(new URL('./fixture.json', import.meta.url), JSON.stringify({ date: f0.slice(0, 10), hits }));
