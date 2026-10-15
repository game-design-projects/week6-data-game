// raw → ../data.json. Run from build/: node build.mjs
// Output: { tags, f, rel, q, sets }
//   tags: option vocabulary (by frequency), f: frequency of each tag in the selected questions,
//   rel : tag → up to 12 tags that most often co-occur with it (over ALL fetched questions, for hard distractors),
//   q   : questions {id,t,g,y,s}, sets: day sets = 5 question indices, one per difficulty tier, mixed years.
import fs from 'node:fs';
import { titleHits } from '../tagged-core.js';
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const META = /^(c\+\+-faq|faq|language-lawyer|homework|code-golf)$/;
const all = [];
for (const f of fs.readdirSync('raw').filter((f) => /^so-\d{4}(-p\d)?\.json$/.test(f))) {
  for (const q of JSON.parse(fs.readFileSync('raw/' + f)).items ?? []) all.push(q);
}
const seen = new Set();
let qs = all.filter((q) => !seen.has(q.question_id) && seen.add(q.question_id));
qs = qs.map((q) => ({ ...q, tags: q.tags.filter((t) => !META.test(t)), title: dec(q.title) }));
const freqAll = {};
for (const q of qs) for (const t of q.tags) freqAll[t] = (freqAll[t] || 0) + 1;
const vocab = new Set(Object.entries(freqAll).filter(([, n]) => n >= 12).map(([t]) => t));
qs = qs.filter((q) => q.tags.length >= 2 && q.tags.length <= 5 && q.tags.every((t) => vocab.has(t)) && q.title.length >= 12 && q.title.length <= 130);
// related tags from the whole vocabulary-compatible pool
const co = {};
for (const q of qs) for (const t of q.tags) for (const u of q.tags) if (t !== u) ((co[t] ||= {})[u] = (co[t][u] || 0) + 1);
// keep per year the top questions, up to 40
const byYear = {};
for (const q of qs) (byYear[new Date(q.creation_date * 1000).getUTCFullYear()] ||= []).push(q);
let sel = [];
for (const y of Object.keys(byYear).sort()) sel.push(...byYear[y].sort((a, b) => b.score - a.score).slice(0, 38));
// deterministic rng
let seed = 76076;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const items = sel.map((q) => ({ id: q.question_id, t: q.title, g: q.tags, y: new Date(q.creation_date * 1000).getUTCFullYear(), s: q.score }));
const freq = {};
for (const q of items) for (const t of q.g) freq[t] = (freq[t] || 0) + 1;
const tags = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
// difficulty = share of tags visible in the title; tiers of 5 quantiles, one question per tier per day
const share = (q) => titleHits(q.t, q.g).length / q.g.length;
const sorted = shuffle(items).sort((a, b) => share(a) - share(b));
const nSets = Math.floor(sorted.length / 5);
const tiers = [0, 1, 2, 3, 4].map((k) => shuffle(sorted.slice(k * nSets, (k + 1) * nSets)));
const q = [...items];
const idx = new Map(q.map((x, i) => [x.id, i]));
const sets = Array.from({ length: nSets }, (_, i) => shuffle(tiers.map((t) => idx.get(t[i].id))));
const rel = {};
for (const t of tags) rel[t] = Object.keys(co[t] || {}).filter((u) => freq[u]).sort((a, b) => co[t][b] - co[t][a] || (a < b ? -1 : 1)).slice(0, 12);
const out = { tags, f: tags.map((t) => freq[t]), rel, q, sets };
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log(q.length, 'questions', sets.length, 'sets', tags.length, 'tags', (fs.statSync('../data.json').size / 1024) | 0, 'KB');
