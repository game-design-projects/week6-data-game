// raw day files -> data.json : per day, 4 stories spread across the score distribution.
import fs from 'node:fs';
const RAW = new URL('./raw/', import.meta.url).pathname;
const days = [];
for (const f of fs.readdirSync(RAW).filter((x) => x.endsWith('.json')).sort()) {
  const hits = JSON.parse(fs.readFileSync(RAW + f, 'utf8')).hits
    .filter((h) => h.title && h.points != null)
    .sort((a, b) => b.points - a.points);
  if (hits.length < 12) continue;
  const n = hits.length;
  const idx = [0, 0.04, 0.2, 0.55].map((q) => Math.min(n - 1, Math.round(q * n)));
  const stories = [...new Set(idx)].map((i) => hits[i]).map((h) => ({
    id: Number(h.objectID), title: h.title,
    domain: h.url ? new URL(h.url).hostname.replace(/^www\./, '') : null,
    points: h.points, comments: h.num_comments || 0,
    hour: new Date(h.created_at_i * 1000).getUTCHours(),
  }));
  if (stories.length === 4) days.push({ date: f.slice(0, 10), stories });
}
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ days }));
console.log(days.length, 'days');
