// raw FRED/BLS CSVs -> ../data.json  (series + pool of "date + 3 items" puzzles)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
process.chdir(dirname(fileURLToPath(import.meta.url)));
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

const FIRST = '1980-01';
const GROUP = { eggs: 'dairy', milk: 'dairy', beef: 'meat', chuck: 'meat', bacon: 'meat', chicken: 'meat', bananas: 'produce', oranges: 'produce', tomatoes: 'produce', bread: 'staple', sugar: 'staple', flour: 'staple', rice: 'staple', coffee: 'drink', oj: 'drink', gas: 'energy', power: 'energy' };
// CPI-U all items, NSA (BLS API CUUR0000SA0, raw/cpi-*.json)
const cpi = {};
for (const f of readdirSync('raw').filter((x) => /^cpi-\d+\.json$/.test(x))) {
  for (const r of JSON.parse(readFileSync(join('raw', f), 'utf8')).Results.series[0].data) cpi[`${r.year}-${r.period.slice(1)}`] = +r.value;
}
for (const it of items) { it.s = Object.fromEntries(Object.entries(it.s).filter(([ym]) => ym >= FIRST)); it.from = Object.keys(it.s).sort()[0]; }
let a = 20261015; const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (arr) => { const r = [...arr]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const RATIO = [1.15, 14]; // price now / price then: the slider spans now/20 .. now*1.5
const eligible = (ym) => items.filter((it) => { const r = it.s[it.to] / it.s[ym]; return it.s[ym] && r >= RATIO[0] && r <= RATIO[1]; });
const pool = [{ ym: '1983-03', items: ['eggs', 'bread', 'gas'] }]; // the original idea: eggs, March 1983
const seen = new Set(['1983-03']);
let guard = 0;
while (pool.length < 90 && guard++ < 20000) {
  const y = 1980 + Math.floor(rnd() * 45); const m = 1 + Math.floor(rnd() * 12);
  const ym = `${y}-${String(m).padStart(2, '0')}`; if (seen.has(ym) || !cpi[ym]) continue;
  const byGroup = {};
  for (const it of eligible(ym)) (byGroup[GROUP[it.key]] ||= []).push(it);
  const groups = Object.keys(byGroup); if (groups.length < 3) continue;
  const chosen = shuffle(groups).slice(0, 3).map((g) => shuffle(byGroup[g])[0].key);
  seen.add(ym); pool.push({ ym, items: chosen });
}
const out = {
  items: Object.fromEntries(items.map((it) => [it.key, { id: it.id, name: it.name, per: it.per, dp: it.dp, from: it.from, to: it.to, s: it.s }])),
  cpi: Object.fromEntries(Object.entries(cpi).filter(([ym]) => ym >= FIRST).sort()),
  pool,
};
writeFileSync('../data.json', JSON.stringify(out));
console.log('pool', pool.length, 'bytes', JSON.stringify(out).length);
