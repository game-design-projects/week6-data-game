// raw etymonline dump + curated word list (words.json) -> ../data.json
// Year = the leading date of the etymonline entry ("1562" exact, "1560s" decade -> midpoint 1565).
import fs from 'node:fs';
const here = new URL('./', import.meta.url).pathname;
const dump = JSON.parse(fs.readFileSync(here + 'raw/etymonline-index.json'));
const list = JSON.parse(fs.readFileSync(here + 'words.json'));

const LANGS = [
  'Low German', 'Middle French', 'Old French', 'French', 'Spanish', 'Portuguese', 'Italian', 'Dutch', 'German', 'Greek', 'Latin', 'Arabic',
  'Hindi', 'Sanskrit', 'Japanese', 'Turkish', 'Nahuatl', 'Carib', 'Arawakan', 'Norwegian', 'Malay', 'Persian', 'Hebrew', 'Icelandic', 'Old Norse', 'Norse',
].map((en) => [en, { 'Middle French': 'French', 'Old French': 'French', Arawakan: 'Arawakan', Norse: 'Old Norse' }[en] ?? en]);
// manual fixes where the first language named in the entry is not the donor language
const OVERRIDE = { karma: 'Sanskrit', jungle: 'Hindi', zombie: 'West African languages', tariff: 'Italian (from Arabic)', shark: 'unknown', ecology: 'Greek roots', photograph: 'Greek roots', bicycle: 'Greek roots', algorithm: 'French (from an Arabic personal name)', sandwich: 'a person\u2019s name (Earl of Sandwich)', coconut: 'Portuguese root', vitamin: 'Latin root', cocaine: 'Spanish root (coca)', picnic: 'French', critique: 'French', saga: 'Old Norse', asbestos: 'Greek', surf: 'unknown', dude: 'unknown', bankruptcy: 'Italian (banca rotta)', stationery: 'formed within English (from station)' };
const fmt = (s) => s.replace(/\s+/g, ' ').trim();
const out = [];
const miss = [];
for (const [w, gloss, pos] of list) {
  const cands = dump.filter((e) => e.word === w && e.etymology && /^(1[5-9]\d\d|20[01]\d)s?\b/.test(e.etymology) && (!pos || e.pos === pos));
  if (!cands.length) { miss.push(w); continue; }
  const e = cands[0];
  const m = e.etymology.match(/^(\d{4})(s?)\b/);
  const decade = m[2] === 's';
  const y = decade ? +m[1] + 5 : +m[1];
  const body = fmt(e.etymology.replace(/\[[^\]]*\]/g, ''));
  // origin language: first language named right after the leading "from"/"borrowed from"
  const head = body.slice(m[0].length, m[0].length + 90);
  let o = '';
  if (/^[,;]?\s*(?:American English,?\s*)?(?:from|borrowed|via)\b/.test(head) || /\bfrom\b/.test(head)) {
    let best = null;
    for (const [en, cn] of LANGS) { const i = head.search(new RegExp(`\\b${en}\\b`)); if (i >= 0 && (!best || i < best.i)) best = { i, cn }; }
    if (best) o = best.cn;
  }
  if (!o) o = 'formed within English';
  if (OVERRIDE[w]) o = OVERRIDE[w];
  let ex = body;
  if (ex.length > 230) { const cut = ex.slice(0, 230); const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; ')); ex = (i > 80 ? cut.slice(0, i) : cut.replace(/\s\S*$/, '')) + (i > 80 && cut[i] === '.' ? '.' : '…');
    ex = ex.replace(/\s*\((?:see|cf\.|compare)?[^)]*$/i, '…').replace(/…{2,}/g, '…'); }
  out.push({ w, gloss, p: e.pos || '', y, d: decade ? 1 : 0, o, ex });
}
if (miss.length) { console.error('MISSING', miss); process.exit(1); }
out.sort((a, b) => a.y - b.y || a.w.localeCompare(b.w));
fs.writeFileSync(here + '../data.json', JSON.stringify({ source: 'etymonline.com via github.com/yosevu/etymonline', words: out }));
const by = {};
out.forEach((x) => { const k = Math.floor(x.y / 50) * 50; by[k] = (by[k] || 0) + 1; });
console.log(out.length, by);
console.log(out.map((x) => `${x.w}:${x.o}`).join(' '));
