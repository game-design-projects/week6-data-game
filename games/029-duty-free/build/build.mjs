// raw HTS JSON -> data.json. Run fetch.sh first. Deterministic (seeded LCG).
// Each tariff line (deduplicated to its 8-digit code) whose General rate is "Free" or a single
// ad valorem % becomes a candidate; puzzles are fixed triples of candidates from different chapters.
import fs from 'node:fs';
import { CHAPTERS } from './chapters.mjs';

const rows = JSON.parse(fs.readFileSync(new URL('./raw/hts.json', import.meta.url)));
const clean = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/(\w)- (?=[\da-z])/g, '$1').replace(/\s+/g, ' ').replace(/ \(\d+\)$/, '').replace(/:$/, '').trim();
const parseRate = (g) => {
  g = (g || '').trim();
  if (g === 'Free') return 0;
  const m = g.match(/^(\d+(?:\.\d+)?)%$/);
  return m ? +m[1] : null;
};

const stack = [];
const seen = new Set();
const cands = [];
for (const r of rows) {
  const ind = +r.indent;
  stack[ind] = clean(r.description || '');
  stack.length = ind + 1;
  const no = r.htsno || '';
  if (no.length < 10) continue; // 8- or 10-digit lines only
  const rate = parseRate(r.general);
  if (rate == null) continue;
  const code = no.slice(0, 10); // 8-digit line (XXXX.XX.XX)
  if (seen.has(code)) continue;
  seen.add(code);
  const path = stack.filter(Boolean);
  const d = path.join(' › ');
  const last = path[path.length - 1];
  const prev = path[path.length - 2] || '';
  if (/^other$/i.test(last) && /^other$/i.test(prev)) continue; // "Other › Other": unguessable
  if (!CHAPTERS[no.slice(0, 2)] || no.startsWith('77')) continue; // skip chapters 98/99 (special provisions)
  if (/provided for in/i.test(d)) continue;
  if (d.length < 25 || d.length > 300) continue;
  if (/\b(duty|duties|tariff|rate of)\b/i.test(d)) continue; // would hint at the answer
  const sp = (r.special || '').trim();
  const o = parseRate(r.other);
  cands.push({
    h: code, c: code.slice(0, 2), d, u: (r.units || []).join(', '), r: rate,
    ...(o != null ? { o } : {}), ...(/^Free\b/.test(sp) ? { f: 1 } : {}),
  });
}

// chapter statistics over every candidate line
const chapters = {};
for (const ch of Object.keys(CHAPTERS)) {
  const rs = cands.filter((x) => x.c === ch).map((x) => x.r).sort((a, b) => a - b);
  if (!rs.length) continue;
  chapters[ch] = { n: rs.length, free: Math.round((100 * rs.filter((v) => v === 0).length) / rs.length), med: rs[Math.floor(rs.length / 2)], max: rs[rs.length - 1] };
}

let s = 29;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const band = (x) => (x.r === 0 ? 'Z' : x.r <= 5 ? 'L' : x.r <= 10 ? 'M' : 'H');
const bk = { Z: [], L: [], M: [], H: [] };
for (const x of shuffle(cands)) bk[band(x)].push(x);
console.log('candidates', cands.length, Object.fromEntries(Object.entries(bk).map(([k, v]) => [k, v.length])));

const N = 90;
const templates = ['ZLH', 'LMH', 'ZMH', 'LLM', 'ZLM', 'MHL', 'ZZH', 'LMM', 'ZLL'];
const items = [];
const puzzles = [];
const chCount = {};
const take = (b, usedCh) => {
  const i = bk[b].findIndex((x) => !usedCh.has(x.c) && (chCount[x.c] || 0) < 5);
  if (i < 0) return null;
  const [x] = bk[b].splice(i, 1);
  chCount[x.c] = (chCount[x.c] || 0) + 1;
  return x;
};
for (let p = 0; puzzles.length < N && p < 400; p++) {
  const t = templates[p % templates.length];
  const used = new Set();
  const trio = [];
  for (const b of t) { const x = take(b, used); if (!x) break; used.add(x.c); trio.push(x); }
  if (trio.length < 3) continue;
  puzzles.push(shuffle(trio).map((x) => { items.push(x); return items.length - 1; }));
}
const out = { fetched: new Date().toISOString().slice(0, 10), chapters, names: CHAPTERS, items, puzzles };
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log('puzzles', puzzles.length, 'items', items.length);
