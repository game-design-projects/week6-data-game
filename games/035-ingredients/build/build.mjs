// raw/*.json (Open Food Facts product API) -> ../data.json
// Uses the top-level ingredient list of each product (label order = descending weight), maps OFF taxonomy ids to English,
// drops OCR junk / non-English / unmatched products, and keeps only products with enough distinctive ingredients.
import fs from 'node:fs'; import path from 'node:path';
import { ALL } from './off-fetch.mjs';
import { display } from './en.mjs';
const raw = path.join(import.meta.dirname, 'raw');
const CAT = [
  ['Drinks', /Sprite|Coca|Fuze|Arizona|Frappuccino|Vitamin|Powerade|Minute|Ovaltine|Red Bull|Monster|Gatorade|Iced Tea|Capri|Nescaf|Soya Drink|Oat Drink|Evian|Orange Juice|Smoothie|Dr Pepper|Mountain|7UP|Schweppes|Perrier|Pepsi|Gatorade|Red Bull|Fanta|Lipton|Alpro|Oatly|Tropicana|Innocent|Sunny D|Hi-C|Kool-Aid|Tang|Snapple|Ocean Spray|V8|Welch|Vita Coco|Lucozade|Ribena|Irn-Bru|Tango|Vimto|Sunkist|A&W|Canada Dry|Barq|Squirt|Celsius|Rockstar|Coffee-mate|Nesquik$/],
  ['Snack bars', /Nature Valley|KIND|Clif|Quest|Larabar|RXBAR|Nutri-Grain|Fruit Roll/],
  ['Breakfast cereal', /Cheerios|Rice Krispies|Shreddies|Weetabix|Frosted|Pop-Tarts|Quaker|Special K|Corn Flakes|Lucky|Froot|Eggo|Cap'n|Cocoa Puffs|Trix|Honey Bunches|Raisin Bran|Cinnamon Toast|Mini-Wheats|Coco Pops|Crunchy Nut|Golden Grahams|Cereal/],
  ['Savory snacks', /Pringles|Doritos|Lay|Cheetos|Fritos|Ruffles|Walkers|Goldfish|Cheez|Takis|Sun Chips|Tostitos|Smartfood|Cracker Jack|Funyuns|Combos|Chex|Bugles|Quavers|Wotsits|Hula|Monster Munch|Skips|Kettle|Cape Cod|Popchips|Snyder|Triscuit|Wheat Thins/],
  ['Sauces & spreads', /Heinz Ketchup|Lea &|French|Kikkoman|Dijon|Cholula|Jif|Skippy|Hellmann|Tabasco|Sriracha|Maggi|Knorr|Barilla|Marmite|Vegemite|Bonne|Smucker|Miracle|Ragú|Prego|Rao|Hidden Valley|A\.1|HP Sauce|Branston|Frank|Sweet Baby|Lee Kum|Kewpie|Colman|Grey Poupon|Dolmio|Campbell|Lotus Biscoff Spread|Nutella|Old El Paso/],
  ['Dairy', /Philadelphia|Babybel|Activia|Danone|Yakult|Ben &|Häagen|Magnum|Yoplait|Chobani|Müller|Kraft Singles|Velveeta|Laughing|Boursin|Cool Whip/],
  ['Quick meals', /Ramen|Indomie|Spam|Heinz Baked Beans|Kraft Mac|Annie|Uncle Ben|Pot Noodle|Maruchan|Shin|Samyang|Hot Pockets|Birds Eye|McCain|Wonder|Pillsbury|Betty/],
  ['Chocolate', /Kinder|Snickers|Twix|M&M|Kit Kat|Toblerone|Hershey|Reese|Milka|Lindt|Lindor|Cadbury|Ritter|Bounty|Mars|Milky|Rolo|Smarties|Maltesers|Galaxy|Raffaello|3 Musketeers|Butterfinger|Baby Ruth|Almond Joy|Mounds|York|Milk Duds|Junior Mints|Crunchie|Wispa|Twirl|Aero|Yorkie|Quality Street|Celebrations|After Eight|Terry|Green &|Whoppers|Creme Egg|Flake|Pocky/],
  ['Candy & gum', /Skittles|Haribo|Tic Tac|Mentos|Chupa|Werther|Jelly|Wrigley|Starburst|Swedish|Twizzlers|Sour Patch|Airheads|Laffy|Nerds|Hi-Chew|Ricola|Halls|Life Savers|Altoids|Trident|Orbit|Hubba/],
  ['Biscuits & bakery', /Oreo|Ritz|Digestive|Tim Tam|Chips Ahoy|Nutter|Belvita|Lu |Prince|Biscoff|Jaffa|Hobnobs|Penguin|Tuc|Grany|Milano|Pepperidge/],
];
const catOf = (n) => CAT.find(([, re]) => re.test(n))?.[0];
import { GENERIC, brandWords } from '../game.js';
const DIV = /^(ingredients|contains.*|less-than|inc|www|org|i|l|ra|contact|contient|best-before|nutritional-values|their-products|derivatives|solids|and|or|of|including|to|a-b-vitamin|and-less-of|per|serving|for|as)$/;
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const missing = {}; const out = []; const names = new Set(); const codes = new Set();
for (const [title, q] of ALL) {
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
    if (names.has(title) || codes.has(p.code)) continue;
    // product / brand words must not appear in an ingredient name (answer leak)
    const words = brandWords(title, p.brands);
    if (ids.some((id) => words.some((w) => id.includes(w)))) continue;
    const cat = catOf(title); if (!cat) { console.log('NO CATEGORY', title); continue; }
    names.add(title); codes.add(p.code);
    out.push({ id: 'p' + String(out.length).padStart(3, '0'), name: title, brand: (p.brands || '').split(',')[0].trim() || title.split(' ')[0], code: p.code, cat, ing: ids });
    break;
  }
}
const dict = {}; for (const o of out) for (const id of o.ing) dict[id] = display(id);
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ fetched: '2026-10-14', products: out, dict }));
console.log(out.length, 'products;', Object.keys(dict).length, 'ingredients');
console.log('missing translations:', Object.entries(missing).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}*${v}`).join(', '));
const bycat = {}; for (const o of out) bycat[o.cat] = (bycat[o.cat] || 0) + 1; console.log(bycat);
