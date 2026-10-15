// raw/*.json (Open Food Facts product API) -> ../data.json
// Uses the top-level ingredient list of each product (label order = descending weight), maps OFF taxonomy ids to Chinese,
// drops OCR junk / non-English / unmatched products, and keeps only products with enough distinctive ingredients.
import fs from 'node:fs'; import path from 'node:path';
import { ALL } from './off-fetch.mjs';
import { display } from './zh.mjs';
const raw = path.join(import.meta.dirname, 'raw');
const CAT = [
  ['饮料', /Sprite|Coca|Fuze|Arizona|Frappuccino|Vitamin|Powerade|Minute|Ovaltine|红牛|Monster|佳得乐|冰红茶|Capri|Nescaf|豆奶|燕麦奶|Evian|橙汁|冰沙|Dr Pepper|Mountain|7UP|Schweppes|Perrier|Pepsi|百事|Gatorade|Red Bull|Fanta|Lipton|Alpro|Oatly|Tropicana|Innocent|Sunny D|Hi-C|Kool-Aid|Tang|Snapple|Ocean Spray|V8|Welch|Vita Coco|Lucozade|Ribena|Irn-Bru|Tango|Vimto|Sunkist|A&W|Canada Dry|Barq|Squirt|Celsius|Rockstar|Coffee-mate|Nesquik$/],
  ['能量棒', /Nature Valley|KIND|Clif|Quest|Larabar|RXBAR|Nutri-Grain|Fruit Roll/],
  ['早餐谷物', /Cheerios|Rice Krispies|Shreddies|Weetabix|Frosted|Pop-Tarts|Quaker|Special K|Corn Flakes|Lucky|Froot|Eggo|Cap'n|Cocoa Puffs|Trix|Honey Bunches|Raisin Bran|Cinnamon Toast|Mini-Wheats|Coco Pops|Crunchy Nut|Golden Grahams|麦片/],
  ['咸味零食', /Pringles|Doritos|Lay|Cheetos|Fritos|Ruffles|Walkers|Goldfish|Cheez|Takis|Sun Chips|Tostitos|Smartfood|Cracker Jack|Funyuns|Combos|Chex|Bugles|Quavers|Wotsits|Hula|Monster Munch|Skips|Kettle|Cape Cod|Popchips|Snyder|Triscuit|Wheat Thins/],
  ['酱料调味', /Heinz 番茄|Lea &|French|Kikkoman|Dijon|Cholula|Jif|Skippy|Hellmann|Tabasco|Sriracha|Maggi|Knorr|Barilla|Marmite|Vegemite|Bonne|Smucker|Miracle|Ragú|Prego|Rao|Hidden Valley|A\.1|HP Sauce|Branston|Frank|Sweet Baby|Lee Kum|Kewpie|Colman|Grey Poupon|Dolmio|Campbell|Lotus Biscoff 抹酱|Nutella|Old El Paso/],
  ['乳制品', /Philadelphia|Babybel|Activia|Danone|Yakult|Ben &|Häagen|Magnum|Yoplait|Chobani|Müller|Kraft 芝士片|Velveeta|Laughing|Boursin|Cool Whip/],
  ['罐头速食', /Ramen|Indomie|Spam|Heinz 焗豆|Kraft 芝士通心粉|Annie|Uncle Ben|Pot Noodle|Maruchan|Shin|Samyang|Hot Pockets|Birds Eye|McCain|Wonder|Pillsbury|Betty/],
  ['巧克力', /Kinder|Snickers|Twix|M&M|Kit Kat|Toblerone|费列罗|Hershey|Reese|Milka|Lindt|瑞士莲|Lindor|Cadbury|Ritter|Bounty|Mars|Milky|Rolo|Smarties|Maltesers|Galaxy|Raffaello|3 Musketeers|Butterfinger|Baby Ruth|Almond Joy|Mounds|York|Milk Duds|Junior Mints|Crunchie|Wispa|Twirl|Aero|Yorkie|Quality Street|Celebrations|After Eight|Terry|Green &|Whoppers|Creme Egg|Flake|Pocky/],
  ['糖果口香糖', /Skittles|Haribo|Tic Tac|Mentos|Chupa|Werther|Jelly|Wrigley|Starburst|Swedish|Twizzlers|Sour Patch|Airheads|Laffy|Nerds|Hi-Chew|Ricola|Halls|Life Savers|Altoids|Trident|Orbit|Hubba/],
  ['饼干烘焙', /Oreo|Ritz|Digestive|Tim Tam|Chips Ahoy|Nutter|Belvita|Lu |Prince|Biscoff|Jaffa|Hobnobs|Penguin|Tuc|Grany|Milano|Pepperidge/],
];
const catOf = (n) => CAT.find(([, re]) => re.test(n))?.[0];
import { GENERIC } from '../game.js';
const DIV = /^(ingredients|contains.*|less-than|inc|www|org|i|l|ra|contact|contient|best-before|nutritional-values|their-products|derivatives|solids|and|or|of|including|to|a-b-vitamin|and-less-of|per|serving|for|as)$/;
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const missing = {}; const out = []; const names = new Set(); const codes = new Set();
for (const [zh, q] of ALL) {
  const key = q.toLowerCase().replace(/\W+/g, '_');
  const word = norm(q.split(/\s+/)[0]);
  for (const suffix of ['', '__1', '__2']) {
    const f = path.join(raw, key + suffix + '.json'); if (!fs.existsSync(f)) continue;
    const p = JSON.parse(fs.readFileSync(f)).product; if (!p?.ingredients) continue;
    if (!norm(`${p.brands} ${p.product_name}`).includes(word)) continue; // search hit is a different brand
    const top = p.ingredients.filter((i) => !(i.id.startsWith('en:') && DIV.test(i.id.slice(3))));
    if (top.some((i) => !i.id.startsWith('en:') || i.is_in_taxonomy !== 1)) continue;
    const ids = [...new Set(top.map((i) => i.id.slice(3)))];
    if (ids.length < 6 || ids.length > 30) continue;
    const un = ids.filter((id) => !display(id)); un.forEach((id) => { missing[id] = (missing[id] || 0) + 1; }); if (un.length) continue;
    if (ids.filter((id) => !GENERIC.has(id)).length < 4) continue; // not guessable from the list
    if (names.has(zh) || codes.has(p.code)) continue;
    // product / brand words must not appear in an ingredient name (answer leak)
    const words = norm(`${zh.replace(/[^\x00-\x7f]+/g, ' ')} ${p.brands}`).length ? `${zh.replace(/[^\x00-\x7f]+/g, ' ')} ${p.brands}`.split(/[^A-Za-z]+/).filter((w) => w.length > 3).map((w) => w.toLowerCase()) : [];
    if (ids.some((id) => words.some((w) => id.includes(w)))) continue;
    const cat = catOf(zh); if (!cat) { console.log('NO CATEGORY', zh); continue; }
    names.add(zh); codes.add(p.code);
    out.push({ id: 'p' + String(out.length).padStart(3, '0'), name: zh, brand: (p.brands || '').split(',')[0].trim() || zh.split(' ')[0], code: p.code, cat, ing: ids });
    break;
  }
}
const dict = {}; for (const o of out) for (const id of o.ing) dict[id] = display(id);
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ fetched: '2026-10-14', products: out, dict }));
console.log(out.length, 'products;', Object.keys(dict).length, 'ingredients');
console.log('missing translations:', Object.entries(missing).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}*${v}`).join(', '));
const bycat = {}; for (const o of out) bycat[o.cat] = (bycat[o.cat] || 0) + 1; console.log(bycat);
