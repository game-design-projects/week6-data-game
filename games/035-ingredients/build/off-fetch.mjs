// Fetch well-known products from Open Food Facts (search-a-licious for barcode, then product API). Cached in raw/.
import fs from 'node:fs'; import path from 'node:path';
import { LIST2 } from './list2.mjs';
const UA = 'daily-data-games/1.0 (NYU class project)';
const raw = path.join(import.meta.dirname, 'raw'); fs.mkdirSync(raw, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// [display name, search query, brand-match regex]
export const LIST = [
 ['Nutella','Nutella','nutella'],['Coca-Cola','Coca-Cola classic','coca'],['Oreo','Oreo original','oreo'],
 ['Pringles Original','Pringles original','pringles'],['Heinz Ketchup','Heinz tomato ketchup','heinz'],['Kinder Bueno','Kinder Bueno','kinder'],
 ['Doritos Nacho Cheese','Doritos nacho cheese','doritos'],['Snickers','Snickers','snickers'],['Twix','Twix','twix'],['M&M\'s Peanut','M&Ms peanut','m&m'],
 ['Ritz Crackers','Ritz crackers','ritz'],['Cheerios','Cheerios','cheerios'],['Frosted Flakes','Frosted Flakes','kellogg'],
 ['Skittles','Skittles original','skittles'],['Haribo Goldbears','Haribo Goldbears','haribo'],['Red Bull','Red Bull energy drink','red bull'],
 ['Pepsi','Pepsi','pepsi'],['Sprite','Sprite','sprite'],['Fanta Orange','Fanta orange','fanta'],['Lay\'s Classic','Lays classic potato chips','lay'],
 ['Cheetos Crunchy','Cheetos crunchy','cheetos'],['Kit Kat','Kit Kat','kit'],['Toblerone','Toblerone milk','toblerone'],['Ferrero Rocher','Ferrero Rocher','ferrero'],
 ['Hershey\'s Milk Chocolate','Hersheys milk chocolate bar','hershey'],['Reese\'s Peanut Butter Cups','Reeses peanut butter cups','reese'],['Pop-Tarts','Pop-Tarts frosted strawberry','pop'],
 ['Nature Valley Oat Bar','Nature Valley crunchy oats honey','nature valley'],['Quaker Oats','Quaker old fashioned oats','quaker'],['Jif Peanut Butter','Jif creamy peanut butter','jif'],
 ['Skippy Peanut Butter','Skippy creamy peanut butter','skippy'],['Hellmann\'s Mayonnaise','Hellmanns real mayonnaise','hellmann'],['Tabasco','Tabasco original red sauce','tabasco'],
 ['Sriracha Hot Sauce','Huy Fong Sriracha','huy fong'],['Maggi','Maggi seasoning','maggi'],['Knorr Chicken Stock Cube','Knorr chicken stock cube','knorr'],
 ['Campbell\'s Tomato Soup','Campbells tomato soup','campbell'],['Kraft Mac & Cheese','Kraft macaroni and cheese','kraft'],['Philadelphia Cream Cheese','Philadelphia cream cheese','philadelphia'],
 ['Mini Babybel','Mini Babybel','babybel'],['Activia Yogurt','Activia','activia'],['Danone Yogurt','Danone yogurt','danone'],['Yakult','Yakult','yakult'],
 ['Barilla Pasta Sauce','Barilla basilico pasta sauce','barilla'],['Ben & Jerry\'s Ice Cream','Ben & Jerry\'s','ben'],['Häagen-Dazs Vanilla','Haagen-Dazs vanilla','h'],
 ['Magnum Classic','Magnum classic','magnum'],['Monster Energy','Monster energy','monster'],['Gatorade','Gatorade','gatorade'],['Lipton Iced Tea','Lipton ice tea','lipton'],
 ['Capri-Sun','Capri-Sun','capri'],['Nescafé Classic','Nescafe classic instant coffee','nescaf'],['Tic Tac','Tic Tac mint','tic'],['Mentos','Mentos','mentos'],
 ['Chupa Chups','Chupa Chups','chupa'],['Milka','Milka alpine milk chocolate','milka'],['Lindt Excellence','Lindt excellence','lindt'],['Haribo Gummy Bears','Haribo','haribo'],
 ['Walkers Ready Salted','Walkers ready salted','walkers'],['McVitie\'s Digestives','McVities digestive','vitie'],['Marmite','Marmite yeast extract','marmite'],['Vegemite','Vegemite','vegemite'],
 ['Tim Tam','Tim Tam original','arnott'],['Pocky','Pocky chocolate','glico'],['Kinder Joy','Kinder Joy','kinder'],['Cadbury Dairy Milk','Cadbury Dairy Milk','cadbury'],
 ['Ritter Sport','Ritter Sport milk','ritter'],['Lotus Biscoff','Lotus Biscoff','lotus'],['Bounty','Bounty','bounty'],['Mars','Mars bar','mars'],['Milky Way','Milky Way','milky'],
 ['Wrigley\'s Extra Gum','Wrigley Extra spearmint','wrigley'],['Alpro Soya Drink','Alpro soya drink original','alpro'],['Oatly Oat Drink','Oatly oat drink','oatly'],['Evian','Evian','evian'],
 ['Tropicana Orange Juice','Tropicana orange juice','tropicana'],['Innocent Smoothie','Innocent smoothie','innocent'],['Dr Pepper','Dr Pepper','dr'],['Mountain Dew','Mountain Dew','mountain'],
 ['7UP','7UP','7'],['Schweppes','Schweppes tonic water','schweppes'],['Perrier','Perrier','perrier'],['Nissin Cup Noodles','Nissin Cup Noodles','nissin'],['Indomie Mi Goreng','Indomie mi goreng','indomie'],
 ['Spam Classic','Spam classic','spam'],['Heinz Baked Beans','Heinz baked beans','heinz'],['Bonne Maman Preserves','Bonne Maman strawberry preserves','bonne'],['Smucker\'s Jam','Smuckers strawberry jam','smucker'],
 ['Kellogg\'s Special K','Special K','kellogg'],['Corn Flakes','Kelloggs Corn Flakes','kellogg'],['Lucky Charms','Lucky Charms','lucky'],['Froot Loops','Froot Loops','froot'],
 ['Eggo Waffles','Eggo waffles','eggo'],['Wonder Bread','Wonder white bread','wonder'],['Goldfish Crackers','Goldfish cheddar','goldfish'],['Cheez-It','Cheez-It original','cheez'],
 ['Triscuit','Triscuit original','triscuit'],['Wheat Thins','Wheat Thins original','wheat'],['Fritos','Fritos corn chips','fritos'],['Ruffles','Ruffles original','ruffles'],

 ['Hershey\'s Kisses','Hersheys Kisses','hershey'],['Rolo','Rolo','rolo'],['Smarties','Smarties','smarties'],['Werther\'s Original','Werthers Original','werther'],
 ['Jelly Belly','Jelly Belly','jelly'],['Maltesers','Maltesers','maltesers'],['Galaxy','Galaxy chocolate','galaxy'],['Haribo Tropifrutti','Haribo Tropifrutti','haribo'],
 ['Lindt Lindor','Lindt Lindor','lindt'],['Raffaello','Raffaello','raffaello'],['Nesquik','Nesquik','nesquik'],['Ovaltine','Ovaltine','ovaltine'],
 ['Fruit Roll-Ups','Fruit Roll-Ups','fruit'],['Chips Ahoy','Chips Ahoy','chips'],['Nutter Butter','Nutter Butter','nutter'],['Belvita','Belvita breakfast biscuits','belvita'],
 ['Pepperidge Farm Milano','Milano cookies','pepperidge'],['Lu Petit Écolier','Lu Petit Ecolier','lu'],['Prince Chocolate Biscuits','Prince chocolate biscuits','lu'],['Grany','Grany','grany'],
 ['Sprite Zero','Sprite zero','sprite'],['Coca-Cola Zero','Coca-Cola Zero','coca'],['Fuze Tea','Fuze tea','fuze'],['Arizona Iced Tea','Arizona green tea','arizona'],
 ['Starbucks Frappuccino','Starbucks Frappuccino','starbucks'],['Vitamin Water','Vitaminwater','vitamin'],['Powerade','Powerade','powerade'],['Minute Maid','Minute Maid orange juice','minute'],
 ['Lea & Perrins Worcestershire','Lea & Perrins Worcestershire','lea'],['French\'s Yellow Mustard','Frenchs yellow mustard','french'],['Kikkoman Soy Sauce','Kikkoman soy sauce','kikkoman'],['Maille Dijon Mustard','Maille Dijon mustard','maille'],
 ['Cholula Hot Sauce','Cholula hot sauce','cholula'],['Old El Paso Taco Shells','Old El Paso taco shells','old'],['Pillsbury Biscuits','Pillsbury biscuits','pillsbury'],['Betty Crocker Cake Mix','Betty Crocker cake mix','betty'],
 ['Rice Krispies','Rice Krispies','kellogg'],['Shreddies','Shreddies','shreddies'],['Weetabix','Weetabix','weetabix'],['Nesquik Cereal','Nesquik cereal','nesquik'],
];
const get = async (u) => { for (let i = 0; i < 3; i++) { const r = await fetch(u, { headers: { 'User-Agent': UA } }); const t = await r.text(); if (r.ok && t[0] === '{') return t; await sleep(3000); } return null; };
export const ALL = [...LIST, ...LIST2];
if (process.argv[1] === import.meta.filename) for (const [name, q] of ALL) {
  const key = q.toLowerCase().replace(/\W+/g, '_');
  const f = path.join(raw, key + '.json'); if (fs.existsSync(f) && fs.existsSync(f.replace('.json','__1.json'))) continue;
  const s = await get(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=8&fields=code,product_name,brands,ingredients_n,countries_tags,unique_scans_n&langs=en`);
  await sleep(1200); if (!s) { console.log('search fail', q); continue; }
  fs.writeFileSync(path.join(raw, 'search_' + key + '.json'), s);
  const hits = JSON.parse(s).hits.filter((h) => (h.ingredients_n || 0) >= 3).sort((a, b) => (b.unique_scans_n || 0) - (a.unique_scans_n || 0));
  if (!hits.length) { console.log('no hit', q); continue; }
  for (const [j, hit] of hits.slice(0, 3).entries()) {
    const p = await get(`https://world.openfoodfacts.org/api/v2/product/${hit.code}.json?fields=code,product_name,brands,ingredients_text_en,ingredients_text,ingredients,ingredients_n,lang`);
    await sleep(1200); if (p) { fs.writeFileSync(j ? f.replace('.json', `__${j}.json`) : f, p); console.log('ok', q, j, hit.code); }
  }
}
