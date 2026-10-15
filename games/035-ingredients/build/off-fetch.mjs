// Fetch well-known products from Open Food Facts (search-a-licious for barcode, then product API). Cached in raw/.
import fs from 'node:fs'; import path from 'node:path';
import { LIST2 } from './list2.mjs';
const UA = 'daily-data-games/1.0 (NYU class project)';
const raw = path.join(import.meta.dirname, 'raw'); fs.mkdirSync(raw, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// [zh display name, search query, brand-match regex]
export const LIST = [
 ['Nutella 榛子巧克力酱','Nutella','nutella'],['可口可乐 Coca-Cola','Coca-Cola classic','coca'],['Oreo 奥利奥','Oreo original','oreo'],
 ['Pringles 原味薯片','Pringles original','pringles'],['Heinz 番茄酱','Heinz tomato ketchup','heinz'],['Kinder Bueno','Kinder Bueno','kinder'],
 ['Doritos 玉米片','Doritos nacho cheese','doritos'],['Snickers 士力架','Snickers','snickers'],['Twix','Twix','twix'],['M&M\'s 花生巧克力豆','M&Ms peanut','m&m'],
 ['Ritz 苏打饼干','Ritz crackers','ritz'],['Cheerios 麦圈','Cheerios','cheerios'],['Frosted Flakes 糖霜玉米片','Frosted Flakes','kellogg'],
 ['Skittles 彩虹糖','Skittles original','skittles'],['Haribo 金熊软糖','Haribo Goldbears','haribo'],['Red Bull 红牛','Red Bull energy drink','red bull'],
 ['Pepsi 百事可乐','Pepsi','pepsi'],['Sprite 雪碧','Sprite','sprite'],['Fanta 芬达橙味','Fanta orange','fanta'],['Lay\'s 乐事原味薯片','Lays classic potato chips','lay'],
 ['Cheetos 奇多','Cheetos crunchy','cheetos'],['Kit Kat','Kit Kat','kit'],['Toblerone','Toblerone milk','toblerone'],['Ferrero Rocher 费列罗','Ferrero Rocher','ferrero'],
 ['Hershey\'s 好时牛奶巧克力','Hersheys milk chocolate bar','hershey'],['Reese\'s 花生酱杯','Reeses peanut butter cups','reese'],['Pop-Tarts','Pop-Tarts frosted strawberry','pop'],
 ['Nature Valley 燕麦棒','Nature Valley crunchy oats honey','nature valley'],['Quaker 燕麦片','Quaker old fashioned oats','quaker'],['Jif 花生酱','Jif creamy peanut butter','jif'],
 ['Skippy 花生酱','Skippy creamy peanut butter','skippy'],['Hellmann\'s 蛋黄酱','Hellmanns real mayonnaise','hellmann'],['Tabasco','Tabasco original red sauce','tabasco'],
 ['Sriracha 是拉差辣酱','Huy Fong Sriracha','huy fong'],['Maggi 美极','Maggi seasoning','maggi'],['Knorr 鸡精','Knorr chicken stock cube','knorr'],
 ['Campbell\'s 番茄汤','Campbells tomato soup','campbell'],['Kraft 芝士通心粉','Kraft macaroni and cheese','kraft'],['Philadelphia 奶油奶酪','Philadelphia cream cheese','philadelphia'],
 ['Babybel 小圆奶酪','Mini Babybel','babybel'],['Activia 酸奶','Activia','activia'],['Danone 酸奶','Danone yogurt','danone'],['Yakult 养乐多','Yakult','yakult'],
 ['Barilla 意面酱','Barilla basilico pasta sauce','barilla'],['Ben & Jerry\'s 冰淇淋','Ben & Jerry\'s','ben'],['Häagen-Dazs 哈根达斯','Haagen-Dazs vanilla','h'],
 ['Magnum 梦龙','Magnum classic','magnum'],['Monster Energy','Monster energy','monster'],['Gatorade 佳得乐','Gatorade','gatorade'],['Lipton 冰红茶','Lipton ice tea','lipton'],
 ['Capri-Sun','Capri-Sun','capri'],['Nescafé 速溶咖啡','Nescafe classic instant coffee','nescaf'],['Tic Tac','Tic Tac mint','tic'],['Mentos','Mentos','mentos'],
 ['Chupa Chups','Chupa Chups','chupa'],['Milka','Milka alpine milk chocolate','milka'],['Lindt 瑞士莲','Lindt excellence','lindt'],['Haribo 小熊软糖','Haribo','haribo'],
 ['Walkers 薯片','Walkers ready salted','walkers'],['Digestive 消化饼干','McVities digestive','vitie'],['Marmite','Marmite yeast extract','marmite'],['Vegemite','Vegemite','vegemite'],
 ['Tim Tam','Tim Tam original','arnott'],['Pocky 百奇','Pocky chocolate','glico'],['Kinder Joy','Kinder Joy','kinder'],['Cadbury Dairy Milk','Cadbury Dairy Milk','cadbury'],
 ['Ritter Sport','Ritter Sport milk','ritter'],['Lotus Biscoff','Lotus Biscoff','lotus'],['Bounty','Bounty','bounty'],['Mars','Mars bar','mars'],['Milky Way','Milky Way','milky'],
 ['Wrigley\'s 口香糖','Wrigley Extra spearmint','wrigley'],['Alpro 豆奶','Alpro soya drink original','alpro'],['Oatly 燕麦奶','Oatly oat drink','oatly'],['Evian','Evian','evian'],
 ['Tropicana 橙汁','Tropicana orange juice','tropicana'],['Innocent 冰沙','Innocent smoothie','innocent'],['Dr Pepper','Dr Pepper','dr'],['Mountain Dew','Mountain Dew','mountain'],
 ['7UP','7UP','7'],['Schweppes','Schweppes tonic water','schweppes'],['Perrier','Perrier','perrier'],['Ramen 日清杯面','Nissin Cup Noodles','nissin'],['Indomie 营多面','Indomie mi goreng','indomie'],
 ['Spam 午餐肉','Spam classic','spam'],['Heinz 焗豆','Heinz baked beans','heinz'],['Bonne Maman 果酱','Bonne Maman strawberry preserves','bonne'],['Smuckers 果酱','Smuckers strawberry jam','smucker'],
 ['Kellogg\'s Special K','Special K','kellogg'],['Corn Flakes','Kelloggs Corn Flakes','kellogg'],['Lucky Charms','Lucky Charms','lucky'],['Froot Loops','Froot Loops','froot'],
 ['Eggo 华夫饼','Eggo waffles','eggo'],['Wonder Bread','Wonder white bread','wonder'],['Goldfish 小鱼饼干','Goldfish cheddar','goldfish'],['Cheez-It','Cheez-It original','cheez'],
 ['Triscuit','Triscuit original','triscuit'],['Wheat Thins','Wheat Thins original','wheat'],['Fritos','Fritos corn chips','fritos'],['Ruffles','Ruffles original','ruffles'],

 ['Hershey\'s Kisses','Hersheys Kisses','hershey'],['Rolo','Rolo','rolo'],['Smarties','Smarties','smarties'],['Werther\'s Original','Werthers Original','werther'],
 ['Jelly Belly','Jelly Belly','jelly'],['Maltesers','Maltesers','maltesers'],['Galaxy','Galaxy chocolate','galaxy'],['Haribo Tropifrutti','Haribo Tropifrutti','haribo'],
 ['Lindor 松露巧克力','Lindt Lindor','lindt'],['Raffaello','Raffaello','raffaello'],['Nesquik','Nesquik','nesquik'],['Ovaltine','Ovaltine','ovaltine'],
 ['Fruit Roll-Ups','Fruit Roll-Ups','fruit'],['Chips Ahoy','Chips Ahoy','chips'],['Nutter Butter','Nutter Butter','nutter'],['Belvita','Belvita breakfast biscuits','belvita'],
 ['Pepperidge Farm Milano','Milano cookies','pepperidge'],['Lu Petit Écolier','Lu Petit Ecolier','lu'],['Prince 巧克力饼干','Prince chocolate biscuits','lu'],['Grany','Grany','grany'],
 ['Sprite Zero','Sprite zero','sprite'],['Coca-Cola Zero','Coca-Cola Zero','coca'],['Fuze Tea','Fuze tea','fuze'],['Arizona 冰茶','Arizona green tea','arizona'],
 ['Starbucks Frappuccino','Starbucks Frappuccino','starbucks'],['Vitamin Water','Vitaminwater','vitamin'],['Powerade','Powerade','powerade'],['Minute Maid','Minute Maid orange juice','minute'],
 ['Lea & Perrins 伍斯特酱','Lea & Perrins Worcestershire','lea'],['French\'s 黄芥末','Frenchs yellow mustard','french'],['Kikkoman 酱油','Kikkoman soy sauce','kikkoman'],['Dijon 芥末','Maille Dijon mustard','maille'],
 ['Cholula 辣酱','Cholula hot sauce','cholula'],['Old El Paso 玉米饼','Old El Paso taco shells','old'],['Pillsbury 饼干面团','Pillsbury biscuits','pillsbury'],['Betty Crocker 蛋糕粉','Betty Crocker cake mix','betty'],
 ['Rice Krispies','Rice Krispies','kellogg'],['Shreddies','Shreddies','shreddies'],['Weetabix','Weetabix','weetabix'],['Nesquik 麦片','Nesquik cereal','nesquik'],
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
