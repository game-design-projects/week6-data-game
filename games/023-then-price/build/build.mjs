// raw FRED/BLS CSVs -> ../data.json  (series + pool of "date + 3 items" puzzles)
import { readFileSync, writeFileSync } from 'node:fs';
const ITEMS = [
  ['APU0000708111', 'eggs', '一打鸡蛋（A 级大号）', '/ 打', 2],
  ['APU0000702111', 'bread', '一磅白面包', '/ 磅', 2],
  ['APU0000709112', 'milk', '一加仑全脂牛奶', '/ 加仑', 2],
  ['APU0000703112', 'beef', '一磅碎牛肉', '/ 磅', 2],
  ['APU0000703111', 'chuck', '一磅牛肩肉糜', '/ 磅', 2],
  ['APU0000704111', 'bacon', '一磅培根', '/ 磅', 2],
  ['APU0000706111', 'chicken', '一磅整鸡', '/ 磅', 2],
  ['APU0000711211', 'bananas', '一磅香蕉', '/ 磅', 2],
  ['APU0000711311', 'oranges', '一磅脐橙', '/ 磅', 2],
  ['APU0000712311', 'tomatoes', '一磅番茄', '/ 磅', 2],
  ['APU0000715211', 'sugar', '一磅白糖', '/ 磅', 2],
  ['APU0000717311', 'coffee', '一磅咖啡粉', '/ 磅', 2],
  ['APU0000701111', 'flour', '一磅面粉', '/ 磅', 2],
  ['APU0000701312', 'rice', '一磅白米', '/ 磅', 2],
  ['APU0000713111', 'oj', '一罐冷冻橙汁浓缩（16 oz）', '/ 罐', 2],
  ['APU000074714', 'gas', '一加仑无铅普通汽油', '/ 加仑', 2],
  ['APU000072610', 'power', '一度电（kWh）', '/ 度', 3],
];
const parse = (id) => Object.fromEntries(readFileSync(`raw/${id}.csv`, 'utf8').trim().split('\n').slice(1).map((l) => l.split(',')).filter((r) => r[1] && r[1] !== '.').map((r) => [r[0].slice(0, 7), +r[1]]));
const items = ITEMS.map(([id, key, name, per, dp]) => { const s = parse(id); const ms = Object.keys(s).sort(); return { id, key, name, per, dp, from: ms[0], to: ms.at(-1), s }; });
// seeded rng
let a = 20261014; const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pool = [];
// hand-picked opener from the idea: eggs, March 1983
pool.push({ ym: '1983-03', items: ['eggs', 'bread', 'gas'] });
const seen = new Set(['1983-03']);
while (pool.length < 90) {
  const y = 1980 + Math.floor(rnd() * 37); const m = 1 + Math.floor(rnd() * 12);
  const ym = `${y}-${String(m).padStart(2, '0')}`; if (seen.has(ym)) continue;
  const ok = items.filter((it) => it.s[ym] && it.s[it.to]);
  if (ok.length < 6) continue;
  // need price to have clearly changed so the question is interesting
  const good = ok.filter((it) => it.s[it.to] / it.s[ym] >= 1.4);
  if (good.length < 3) continue;
  const pickN = [...good].sort(() => rnd() - 0.5).slice(0, 3);
  seen.add(ym); pool.push({ ym, items: pickN.map((i) => i.key) });
}
const out = {
  asOf: items[0].to,
  items: Object.fromEntries(items.map((it) => [it.key, { id: it.id, name: it.name, per: it.per, dp: it.dp, from: it.from, to: it.to, s: it.s }])),
  pool,
};
writeFileSync('../data.json', JSON.stringify(out));
console.log('pool', pool.length, 'bytes', JSON.stringify(out).length);
