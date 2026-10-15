// raw NYPL "What's on the Menu?" CSVs + US CPI-U (datasets/cpi-us) -> data.json
// Pool of US menus 1880-1990, each with 4 priced FOOD dishes (drinks dropped: wine/spirits are priced per
// bottle or glass inconsistently, which makes the question unfair). d[0] is the anchor.
import fs from 'node:fs';
import { parse } from './csv.mjs';
const R = (f) => parse(fs.readFileSync(new URL(`./raw/${f}`, import.meta.url), 'utf8'));
const rows = (t) => { const [h, ...r] = t; return r.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]]))); };

const US = /(,\s*\(?\[?(A[LKZR]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\]?\)?[.?;\s]*$)|NEW YORK|\bN\.? ?Y\.?\b|\bNYC\b|BROOKLYN|MANHATTAN|BROADWAY|CHICAGO|BOSTON|PHILADELPHIA|SAN FRANCISCO|U\.? ?S\.? ?A\b|FIFTH AVE|HOBOKEN|NEWARK|BALTIMORE|WASHINGTON|CLEVELAND|ST\.? LOUIS/;
const FOREIGN = /CUBA|MEXICO|CANADA|LONDON|PARIS|HAVANA|PANAMA|JAPAN|CHINA|STEAMER|S\.?S\.? |EN ROUTE|PACIFIC OCEAN|ATLANTIC OCEAN/;
const DRINK = /\b(wines?|champagnes?|claret|port|sherry|gin|whisk(e)?y|brandy|rum|beers?|ales?|stout|porter|bourbon|cognac|cordial|liqueur|burgundy|sauternes?|madeira|bitters|punch|cocktails?|vermouth|rye|scotch|chablis|bordeaux|hock|moselle|cider|lager|schnapps|absinthe|maraschino|sparkling|vintage|cuvee|brut|medoc|chateau|latour|larose|monopole|amontillado|curacao|cura[cç]ao|creme de|cr[eè]me de|benedictine|chartreuse|kummel|kirsch|champagne|mumm|moet|heidsieck|roederer|pommery|giesler|rhine|riesling|zinfandel|burgundies|beaujolais|cockburn|estephe|julien|margaux|lafite|sauvignon|chianti|marsala|muscat|tokay|malaga|malmsey|toddy|highball|martini|manhattan|daiquiri|bottle|quart|magnum|split|nip|jigger|vichy|apollinaris|seltzer)\b/i;
const FOOD = /(soup|broth|consomm|bisque|chowder|steak|chop|cutlet|roast|broil|fried|fry|baked|boiled|stew|hash|salad|slaw|pie|tart|cake|pudding|custard|pastry|pastries|cookie|biscuit|muffin|waffle|pancake|griddle|toast|bread|roll|bun|butter|cheese|egg|omelet|omelette|ham|bacon|sausage|frankfurter|hot dog|liver|kidney|tongue|tripe|beef|pork|veal|lamb|mutton|venison|rabbit|chicken|capon|duck|goose|turkey|squab|quail|pigeon|grouse|partridge|game hen|oyster|clam|crab|lobster|shrimp|scallop|fish|salmon|trout|bass|cod|haddock|halibut|sole|flounder|bluefish|shad|herring|sardine|anchov|tuna|eel|frog|escargot|caviar|potato|tomato|onion|corn|bean|pea|peas|asparagus|spinach|cabbage|cauliflower|carrot|beet|turnip|celery|lettuce|radish|cucumber|mushroom|pepper|squash|rice|spaghetti|macaroni|noodle|chop suey|chow mein|pasta|ravioli|pizza|sandwich|burger|hamburger|steak|rib|loin|tenderloin|porterhouse|sirloin|filet|fillet|turtle|apple|pear|peach|plum|prune|cherry|berry|berries|strawberr|banana|orange|grapefruit|lemon|melon|grape|pineapple|fig|date|fruit|compote|preserve|marmalade|jelly|jam|honey|syrup|ice cream|sherbet|sundae|ice|cream|chocolate|cocoa|coffee|tea|juice|cereal|oatmeal|mush|grits|toast|pickle|olive|relish|sauce|dressing|gravy|crackers|nuts|almond|walnut|stuffing|dumpling|pot roast|casserole|curry|tamale|taco|enchilada|chili|bologna|salami|pate|terrine|souffl|mousse|eclair|cobbler|brownie|donut|doughnut|cracker|sweetbread|brain|marrow|jello|gelatin)/i;
const FOOD_JUNK = /\b(club|cheese and|etc|unknown|see|extra charge|cover|service|tax)\b/i;

const KEEP = new Set(['NY', 'NYC', 'NJ', 'PA', 'DC', 'USA', 'US', 'CT', 'MA', 'IL', 'OH', 'CA', 'MO', 'MD', 'VA', 'II', 'III', 'IV', 'YMCA', 'YWCA', 'GAR', 'AT&T', 'RR', 'RMS', 'SS']);
const SMALL = new Set(['OF', 'THE', 'AND', 'AT', 'IN', 'ON', 'FOR', 'TO', 'DE', 'LA']);
// slider ranges per era -- keep in sync with rangeFor() in game.js; out-of-range prices are data errors/outliers
const rangeFor = (y) => (y < 1930 ? { min: 0.02, max: 10 } : y < 1960 ? { min: 0.05, max: 25 } : { min: 0.1, max: 60 });
const title = (s) => s.replace(/\s+/g, ' ').trim().replace(/[A-Za-z0-9][A-Za-z0-9'’.&]*/g, (w, off) => {
  if (w !== w.toUpperCase() || !/[A-Z]/.test(w)) return w;
  if (KEEP.has(w.replace(/\./g, ''))) return w;
  if (SMALL.has(w) && off > 0) return w.toLowerCase();
  return w[0] + w.slice(1).toLowerCase();
});
const caps = (s) => (s.replace(/[^A-Za-z]/g, '') === s.replace(/[^A-Z]/g, '') ? title(s) : s);
const clean = (s) => s.replace(/[;\[\]?()*"]/g, '').replace(/\s+/g, ' ').trim();

const menus = rows(R('Menu.csv'));
const pages = rows(R('MenuPage.csv'));
const dishes = new Map(rows(R('Dish.csv')).map((d) => [d.id, d]));
console.error('menus', menus.length, 'pages', pages.length, 'dishes', dishes.size);

const okMenu = new Map();
for (const m of menus) {
  const y = +m.date.slice(0, 4);
  if (!(y >= 1880 && y <= 1990)) continue;
  if (m.currency && m.currency !== 'Dollars') continue;
  const place = clean(m.place || ''), who = clean(m.sponsor || '');
  if (who.length < 3 || who.length > 48 || place.length < 3) continue;
  const up = place.toUpperCase();
  if (FOREIGN.test(up) || (!m.currency && !US.test(up))) continue;
  okMenu.set(m.id, { id: m.id, year: y, sponsor: caps(who), place: caps(place), event: caps(clean(m.event || '')), items: [] });
}
const pageMenu = new Map(pages.filter((p) => okMenu.has(p.menu_id)).map((p) => [p.id, p.menu_id]));

const [h, ...rest] = R('MenuItem.csv');
const ix = Object.fromEntries(h.map((k, i) => [k, i]));
for (const r of rest) {
  const mid = pageMenu.get(r[ix.menu_page_id]);
  if (!mid || !r[ix.price] || r[ix.high_price]) continue;
  const price = +r[ix.price];
  const d = dishes.get(r[ix.dish_id]);
  if (!d || !(price >= 0.03 && price <= 60)) continue;
  const name = d.name.trim();
  if (name.length < 4 || name.length > 36 || /\d|[^\x20-\x7e]|[\[\]()?]/.test(name)) continue;
  if (+d.times_appeared < 3) continue;
  okMenu.get(mid).items.push({ name: caps(name), price, raw: name });
}

function rngFn(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); }
const rnd = rngFn(24);
const cands = [];
for (const m of okMenu.values()) {
  const seen = new Set(); const it = [];
  for (const i of m.items) {
    const k = i.name.toLowerCase();
    const rg = rangeFor(m.year);
    if (i.price < rg.min || i.price > rg.max * 0.8 || seen.has(k) || DRINK.test(i.raw) || !FOOD.test(i.raw) || FOOD_JUNK.test(i.raw)) continue;
    seen.add(k); it.push(i);
  }
  if (it.length < 9 || new Set(it.map((i) => i.price)).size < 5) continue;
  it.sort((a, b) => a.price - b.price);
  const n = it.length;
  const pct = (x) => Math.round((100 * it.filter((j) => j.price < x.price).length) / (n - 1));
  // anchor = a mid-priced staple; targets span cheap / mid-high / expensive
  const q = [0.4, 0.08, 0.65, 0.95].map((f) => it[Math.floor(f * (n - 1))]);
  if (new Set(q.map((x) => x.price)).size < 4) continue;
  if (q[3].price / q[1].price < 2) continue; // need a real spread
  cands.push({ m, anchor: q[0], targets: q.slice(1), n, pct });
}
console.error('candidates', cands.length);
const byDec = {};
for (const c of cands) (byDec[Math.floor(c.m.year / 10)] ||= []).push(c);
const out = [];
for (const dec of Object.keys(byDec).sort()) {
  const arr = byDec[dec].map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, 14);
  for (const c of arr) {
    const t = c.targets.map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    out.push({ id: +c.m.id, y: c.m.year, who: c.m.sponsor, where: c.m.place, ev: c.m.event, n: c.n,
      d: [c.anchor, ...t].map((x) => [x.name, x.price, c.pct(x)]) });
  }
  console.error(dec, arr.length, '/', byDec[dec].length);
}

// CPI-U annual mean -> factor to the latest month (1913+)
const cpiRows = parse(fs.readFileSync(new URL('./raw/cpi.csv', import.meta.url), 'utf8')).slice(1).filter((r) => r[1]);
const byY = {};
for (const [d, v] of cpiRows) (byY[d.slice(0, 4)] ||= []).push(+v);
const last = cpiRows[cpiRows.length - 1];
const latest = +last[1];
const cpi = {};
for (const [y, a] of Object.entries(byY)) if (+y <= 1990 && a.length === 12) cpi[y] = +(latest / (a.reduce((s, x) => s + x, 0) / 12)).toFixed(2);
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ cpiBase: last[0].slice(0, 7), cpi, menus: out }));
console.error('wrote', out.length);
