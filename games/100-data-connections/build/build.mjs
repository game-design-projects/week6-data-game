// raw (build/raw/*.json from fetch.mjs) → ../data.json.  Run from build/: node build.mjs
import { SEEDS, KINDS, LAND, SHORT } from './seeds.mjs';
import fs from 'node:fs';
const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, '_');
let s = 20261015; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuf = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// The original member selection (and its random stream) filtered on the Simplified Chinese labels; those filters
// and the Chinese seed names live in raw/zh-filter.json so a rebuild reproduces exactly the same puzzles.
const ZH = JSON.parse(fs.readFileSync('raw/zh-filter.json'));
const TRAD = new RegExp(`[${ZH.trad}]`);
const EN = JSON.parse(fs.readFileSync('raw/labels-en.json'));
const HAN = /[\u4e00-\u9fff]/;
const PAREN = /[(\uff08]/;
const groups = [];
const dropLog = [];
for (const [kind, en] of SEEDS) {
  const zh = ZH.names[`${kind}|${en}`];
  const short = SHORT[en] ?? en;
  const f = `raw/${kind}_${slug(en)}.json`;
  if (!fs.existsSync(f)) { dropLog.push(`${en}: no raw`); continue; }
  const raw = JSON.parse(fs.readFileSync(f));
  const K = KINDS[kind];
  const seen = new Map();
  for (const b of raw.items) {
    const id = b.item.value.split('/').pop();
    let label = b.zh.value.trim();
    const e = b.en?.value ?? '';
    const y = b.y ? +b.y.value : null;
    const prev = seen.get(id);
    if (prev) { if (y && (!prev.y || y < prev.y)) prev.y = y; continue; }
    seen.set(id, { id, label, en: e, y, sl: +b.sl.value, name: EN[id] ?? e });
  }
  const members = [];
  for (const m of seen.values()) {
    if (m.label === '\u4e2d\u534e\u4eba\u6c11\u5171\u548c\u56fd') m.label = '\u4e2d\u56fd';
    if (/^Q\d+$/.test(m.label) || m.label.length < 2 || m.label.length > 18) continue;
    if (!HAN.test(m.label)) continue; // (original selection) latin-only titles were dropped
    if (TRAD.test(m.label) || PAREN.test(m.label)) continue;
    if (kind === 'border' && !LAND[en].includes(m.en)) continue;
    if (kind !== 'border' && m.sl < 8) continue;
    if (m.label.length <= 5 && m.label.includes('·')) continue; // (original selection) two-part short titles read as typos
    if (kind === 'music' && /\u5de1\u56de|\u6f14\u5531\u4f1a|\u5408\u96c6|\u7cbe\u9009/.test(m.label)) continue;
    if (m.label.includes(zh) || (m.en && m.en.toLowerCase().includes(en.toLowerCase().split(' ').pop()) && kind !== 'border')) continue;
    members.push(m);
  }
  members.sort((a, b) => b.sl - a.sl);
  if (members.length < 9) { dropLog.push(`${en}: only ${members.length} usable`); continue; }
  groups.push({ key: raw.qid, kind, prop: K.prop, en, zh, short, label: K.tpl.replace('{}', short), unit: K.unit, members });
}
console.log('groups', groups.length, groups.map((g) => g.en + g.members.length).join(' '));
console.log('dropped:', dropLog.join('; '));

const POOL = 11; // each group draws from its 11 best-known members
for (const g of groups) { g.pool = g.members.slice(0, POOL); g.ids = new Set(g.members.map((m) => m.id)); g.labs = new Set(g.members.map((m) => m.label)); }
const usable = groups.filter((g) => g.pool.length >= 8);
console.log('usable groups', usable.length, usable.map((g) => `${g.en}:${g.pool.length}`).join(' '));

const puzzles = []; const seenKey = new Set(); const use = new Map(usable.map((g) => [g.key, 0]));
for (let tries = 0; tries < 200000 && puzzles.length < 120; tries++) {
  // prefer under-used groups so the whole pool is exercised evenly
  const ordered = shuf(usable).sort((a, b) => use.get(a.key) - use.get(b.key) + (rnd() - 0.5) * 3);
  const gs = ordered.slice(0, 4);
  const units = gs.map((g) => g.unit);
  const maxSame = Math.max(...units.map((u) => units.filter((x) => x === u).length));
  if (new Set(units).size < 2 || maxSame > 3 || (maxSame === 3 && rnd() < 0.7) || units.filter((u) => u === 'country').length > 2) continue;
  if (new Set(gs.map((g) => g.zh)).size < 4) continue;
  const key = gs.map((g) => g.key).sort().join();
  if (seenKey.has(key)) continue;
  const chosen = gs.map((g) => shuf(g.pool).slice(0, 4));
  // ambiguity: a pick may not appear (by Wikidata id or by label) anywhere in another chosen group's full fetched list
  if (gs.some((g, i) => chosen.some((c, j) => i !== j && c.some((x) => g.ids.has(x.id) || g.labs.has(x.label))))) continue;
  const labs = chosen.flat().map((x) => x.label);
  if (new Set(labs).size !== 16) continue;
  // an item may not mention any group's subject name, and no member may sit in another chosen group's fetched list
  const names = gs.flatMap((g) => g.zh.split(/[·\s]/).filter((p) => p.length >= 2));
  if (labs.some((l) => names.some((n) => l.includes(n)))) continue;
  seenKey.add(key); gs.forEach((g) => use.set(g.key, use.get(g.key) + 1));
  puzzles.push({ groups: gs.map((g, i) => ({ label: g.label, n: g.short, qid: g.key, kind: g.kind, prop: g.prop, unit: g.unit, items: chosen[i].map((x) => ({ l: x.name === "People's Republic of China" ? 'China' : x.name, q: x.id, ...(x.y ? { y: x.y } : {}) })) })) });
}
console.log('puzzles', puzzles.length, 'group use min/max', Math.min(...use.values()), Math.max(...use.values()));
fs.writeFileSync('../data.json', JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), puzzles }));
