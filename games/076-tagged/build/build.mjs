// raw → data.json : questions (title, tags) + popular-tag list for distractors.
import fs from 'node:fs';
const dec = (s) => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
let qs = [];
for (const f of fs.readdirSync('raw').filter((f) => f.startsWith('so-'))) {
  for (const q of JSON.parse(fs.readFileSync('raw/' + f)).items ?? []) qs.push(q);
}
qs = qs.filter((q) => q.tags.length >= 2 && q.tags.length <= 5);
const freq = {};
for (const q of qs) for (const t of q.tags) freq[t] = (freq[t] || 0) + 1;
const tags = Object.entries(freq).filter(([, n]) => n >= 6).sort((a, b) => b[1] - a[1]).map(([t]) => t);
const keep = new Set(tags);
// every real tag must be in the vocabulary so the player can pick it; drop questions with rare tags
qs = qs.filter((q) => q.tags.every((t) => keep.has(t)));
const out = {
  tags,
  questions: qs.map((q) => ({ id: q.question_id, t: dec(q.title), g: q.tags, y: new Date(q.creation_date * 1000).getUTCFullYear(), s: q.score })),
};
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log(out.questions.length, 'questions', tags.length, 'tags');
