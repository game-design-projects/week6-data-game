// raw/*.json (Open Food Facts product API) -> ../data.json
import fs from 'node:fs'; import path from 'node:path';
import { LIST } from './off-fetch.mjs';
const raw = path.join(import.meta.dirname, 'raw');
const CAT = {
  饮料: /Sprite|Coca|Fuze|Arizona|Frappuccino|Vitamin|Powerade|Minute|Nesquik$|Ovaltine|可乐|雪碧|芬达|红牛|Monster|佳得乐|冰红茶|Capri|Nescaf|豆奶|燕麦奶|Evian|橙汁|冰沙|Dr Pepper|Mountain|7UP|Schweppes|Perrier|百事|Pepsi/,
  巧克力糖果: /Kinder|Snickers|Twix|M&M|Skittles|Haribo|Kit Kat|Toblerone|费列罗|好时|Reese|Tic Tac|Mentos|Chupa|Milka|瑞士莲|Cadbury|Ritter|Bounty|Mars|Milky|Wrigley|Pocky|Nutella|Rolo|Smarties|Werther|Jelly|Maltesers|Galaxy|Lindor|Raffaello|Kisses|Roll/,
  咸味零食: /Pringles|Doritos|Lay|Cheetos|Fritos|Ruffles|Walkers|Goldfish|Cheez/,
  酱料调味: /Lea &|French|Kikkoman|Dijon|Cholula|番茄酱|Jif|Skippy|Hellmann|Tabasco|Sriracha|Maggi|Knorr|Barilla|Marmite|Vegemite|果酱|Bonne|Smucker/,
  乳制品: /Philadelphia|Babybel|Activia|Danone|Yakult|Ben &|Häagen|Magnum/,
  早餐谷物: /Cheerios|Rice Krispies|Shreddies|Weetabix|Nesquik 麦片|Frosted|Pop-Tarts|Nature Valley|Quaker|Special K|Corn Flakes|Lucky|Froot|Eggo/,
};
const catOf = (n) => Object.keys(CAT).find((k) => CAT[k].test(n)) || '主食饼干罐头';
const nice = (i) => {
  const [lang, rest] = i.id.includes(':') ? [i.id.split(':')[0], i.id.split(':').slice(1).join(':')] : ['en', i.id];
  let t = rest.replace(/-/g, ' ');
  if (/^\d{3}[a-z]*$/.test(t)) t = 'E' + t;
  if (/^e\d{3}[a-z]*(ii|i|iii)?$/i.test(t)) t = t.toUpperCase().replace(/(I+)$/, (m) => m.toLowerCase());
  return { name: t, en: lang === 'en' };
};
const out = []; const seen = new Set();
for (const [zh, q] of LIST) {
  const key = q.toLowerCase().replace(/\W+/g, '_');
  for (const suffix of ['', '__1', '__2']) {
    const f = path.join(raw, key + suffix + '.json'); if (!fs.existsSync(f)) continue;
    const p = JSON.parse(fs.readFileSync(f)).product; if (!p?.ingredients) continue;
    const ings = p.ingredients.map((i) => ({ ...nice(i), pct: Math.round((i.percent_estimate || 0) * 10) / 10 }));
    if (ings.length < 6 || ings.length > 40 || ings.some((i) => !i.en || i.name.split(' ').length > 4 || i.name.length > 40 || i.name.length < 3 || /\d/.test(i.name.replace(/^E\d+[a-zA-Z]*$/, '')))) continue;
    if (seen.has(p.code) || out.some((o) => o.name === zh)) continue; seen.add(p.code);
    out.push({ id: 'p' + out.length, name: zh, brand: (p.brands || '').split(',')[0].trim(), code: p.code, cat: catOf(zh), ing: ings.map((i) => [i.name, i.pct]) });
    break;
  }
}
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), products: out }));
console.log(out.length, 'products');
for (const o of out) console.log(o.name, o.cat, o.ing.length, o.ing.slice(-3).map((x) => x[0]).join('|'));
