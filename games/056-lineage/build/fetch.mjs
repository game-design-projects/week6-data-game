// Fetch royal-house membership from Wikidata. Raw responses cached in raw/.
import fs from 'node:fs';
const UA = 'DailyDataGames/1.0 (NYU class project; lishuyustevenli@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raw = (f) => new URL(`./raw/${f}`, import.meta.url).pathname;
fs.mkdirSync(new URL('./raw/', import.meta.url).pathname, { recursive: true });

async function getJSON(url, file, tries = 4) {
  if (fs.existsSync(raw(file))) { try { return JSON.parse(fs.readFileSync(raw(file), 'utf8')); } catch {} }
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json,application/json' }, signal: AbortSignal.timeout(90000) }).catch(() => null);
    const txt = res && res.ok ? await res.text() : '';
    if (txt.startsWith('{')) { fs.writeFileSync(raw(file), txt); await sleep(1500); return JSON.parse(txt); }
    await sleep(6000 * (i + 1));
  }
  return null;
}
const sparql = (q, file) => getJSON('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), file);

// 1. houses found by the monarch-with-father query (houses.json came from build/q1.rq)
const base = JSON.parse(fs.readFileSync(raw('houses.json'), 'utf8')).results.bindings
  .map((b) => ({ qid: b.h.value.split('/').pop(), name: b.hLabel.value }));

// 2. famous houses that Wikidata models with weaker links: resolve by name
const extra = ['House of Bourbon', 'House of Capet', 'House of Valois', 'House of Tudor', 'House of Stuart', 'House of Hanover', 'House of Windsor',
  'House of Romanov', 'House of Medici', 'House of Hohenstaufen', 'House of Normandy', 'House of Grimaldi', 'House of Orléans', 'House of Braganza',
  'House of Trastámara', 'House of Wettin', 'House of Jagiellon', 'Piast dynasty', 'Hashemites', 'Pahlavi dynasty', 'Qajar dynasty', 'Safavid dynasty',
  'Tokugawa clan', 'Ottoman dynasty', 'Ptolemaic dynasty', 'Julio-Claudian dynasty', 'Aisin Gioro', 'House of Borja', 'House of Blois', 'House of York',
  'House of Lancaster', 'House of Anjou', 'House of Hanover', 'House of Savoy', 'Ming dynasty', 'House of Zähringen', 'House of Nassau', 'House of Wasa',
  'House of Bonaparte', 'House of Osman', 'House of Gonzaga', 'House of Este', 'House of Sforza', 'House of Visconti', 'House of Welf', 'Hohenzollern'];
const resolved = [];
for (const n of extra) {
  const r = await getJSON(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(n)}&language=en&type=item&limit=5&format=json`, `search-${n.replace(/\W+/g, '_')}.json`);
  const hit = r?.search?.find((s) => /house|dynasty|family|clan|royal/i.test(s.description || '') && s.label?.toLowerCase() === n.toLowerCase()) || r?.search?.find((s) => /house|dynasty|family|clan|royal/i.test(s.description || ''));
  if (hit) resolved.push({ qid: hit.id, name: hit.label });
}
const houses = [...new Map([...base, ...resolved].map((h) => [h.qid, h])).values()];
console.log('houses', houses.length);

// 3. members per house
for (const h of houses) {
  const q = `SELECT ?p ?pLabel ?b ?d ?g ?f ?m ?title ?titleLabel ?sl ?cLabel ?contLabel WHERE {
    ?p wdt:P53 wd:${h.qid} . ?p wdt:P569 ?b .
    OPTIONAL { ?p wdt:P570 ?d } OPTIONAL { ?p wdt:P21 ?g } OPTIONAL { ?p wdt:P22 ?f } OPTIONAL { ?p wdt:P25 ?m }
    OPTIONAL { ?p wdt:P39|wdt:P97 ?title } OPTIONAL { ?p wikibase:sitelinks ?sl }
    OPTIONAL { ?p wdt:P27 ?c . OPTIONAL { ?c wdt:P30 ?cont } }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 3000`;
  const r = await sparql(q, `house-${h.qid}.json`);
  console.log(h.qid, h.name, r ? r.results.bindings.length : 'FAILED');
  await sleep(1200);
}
fs.writeFileSync(raw('houselist.json'), JSON.stringify(houses));
