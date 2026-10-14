// Fetch Google Books Ngram (en-2019, 1800-2019, smoothing 3) for the word list. Cached in raw/.
import fs from 'node:fs'; import path from 'node:path';
const dir = path.join(import.meta.dirname, 'raw'); fs.mkdirSync(dir, { recursive: true });
const CAP = new Set(['paris','london','berlin','moscow','rome','vienna','darwin','einstein','freud','marx','google','african','negro','nazi']);
const q = (w) => (CAP.has(w) ? w[0].toUpperCase() + w.slice(1) : w);
const words = fs.readFileSync(path.join(import.meta.dirname, 'wl.txt'), 'utf8').split('\n').filter(Boolean);
const out = path.join(dir, 'ngram.json');
const cache = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out)) : {};
const todo = words.filter((w) => !cache[w]);
for (let i = 0; i < todo.length; i += 8) {
  const batch = todo.slice(i, i + 8);
  const url = `https://books.google.com/ngrams/json?content=${batch.map((w) => encodeURIComponent(q(w))).join(',')}&year_start=1800&year_end=2019&corpus=en-2019&smoothing=3`;
  for (let t = 0; t < 4; t++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games class project (NYU)' } });
    if (r.ok) { const j = await r.json(); for (const s of j) { const w = s.ngram.toLowerCase(); if (batch.includes(w)) cache[w] = s.timeseries; } break; }
    console.error('retry', r.status); await new Promise((r) => setTimeout(r, 8000));
  }
  fs.writeFileSync(out, JSON.stringify(cache)); console.log(i, Object.keys(cache).length);
  await new Promise((r) => setTimeout(r, 2500));
}
