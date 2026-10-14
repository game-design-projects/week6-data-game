import { SEEDS } from './seeds.mjs';
import fs from 'node:fs';
let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuf = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const groups = [];
for (const [prop, qid, en, tpl] of SEEDS) {
  const f = `raw/${prop}_${qid}.json`;
  if (!fs.existsSync(f)) continue;
  const raw = JSON.parse(fs.readFileSync(f));
  const lab = raw.label?.[0]; if (!lab || lab.en.value !== en) { console.warn('label mismatch', qid, lab?.en?.value); continue; }
  const OV = { Q7374: '希区柯克', Q8877: '斯皮尔伯格', Q55400: '宫崎骏', Q1299: '披头士', Q142: '法国', Q183: '德国', Q148: '中国' };
  const name = OV[qid] ?? lab.zh?.value ?? en;
  const seen = new Set(); const all = [];
  for (const b of raw.items ?? []) {
    const id = b.item.value.split('/').pop(); const label = b.zh.value.trim();
    if (seen.has(id) || /^Q\d+$/.test(label) || label.length > 14 || label.length < 2 || /[(（]/.test(label)) continue;
    if (label.includes(name) || (b.en && b.en.value.includes(en))) continue;
    seen.add(id); all.push({ id, label, sl: +b.sl.value });
  }
  if (all.length < 8) { console.warn('too few', qid, all.length); continue; }
  groups.push({ key: qid, prop, label: tpl.replace('{}', name), members: all });
}
console.log('groups', groups.length);
const memberOf = (g) => new Set(g.members.map((m) => m.id));
const memLabels = (g) => new Set(g.members.map((m) => m.label));
groups.forEach((g) => { g.ids = memberOf(g); g.labs = memLabels(g); });
const puzzles = []; const seenKey = new Set();
for (let tries = 0; tries < 20000 && puzzles.length < 120; tries++) {
  const gs = shuf(groups).slice(0, 4);
  if (new Set(gs.map((g) => g.prop)).size < 2) continue;
  const chosen = [];
  let ok = true;
  for (const g of gs) {
    const pool = g.members.slice(0, 12);
    const picks = shuf(pool).slice(0, 4);
    chosen.push(picks);
  }
  const labs = chosen.flat().map((x) => x.label);
  if (new Set(labs).size !== 16) continue;
  gs.forEach((g, i) => chosen.forEach((c, j) => { if (i !== j && c.some((x) => g.ids.has(x.id) || g.labs.has(x.label))) ok = false; }));
  if (!ok) continue;
  const key = gs.map((g) => g.key).sort().join();
  if (seenKey.has(key)) continue; seenKey.add(key);
  const diff = chosen.map((c) => c.reduce((a, x) => a + Math.log10(x.sl), 0) / 4);
  puzzles.push({ groups: gs.map((g, i) => ({ label: g.label, qid: g.key, prop: g.prop, items: chosen[i].map((x) => ({ l: x.label, q: x.id }))  })) });
}
console.log('puzzles', puzzles.length);
fs.writeFileSync('../data.json', JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), puzzles }));
