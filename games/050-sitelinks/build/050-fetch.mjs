// Fetch candidate items per category from Wikidata SPARQL (ids only), then entity data
// (en/zh labels, en description, sitelinks) from the Wikidata API. Everything cached in raw/.
import fs from 'node:fs';
const UA = 'DailyDataGames/1.0 (class project; lishuyustevenli@gmail.com)';
// key: [class QID, min total sitelinks, zh name, take-all?]
export const CATS = {
  city: ['Q515', 40, '城市'], bigcity: ['Q1549591', 60, '大城市'], country: ['Q6256', 100, '国家', true],
  element: ['Q11344', 10, '化学元素', true], videogame: ['Q7889', 30, '电子游戏'], album: ['Q482994', 35, '专辑'],
  volcano: ['Q8072', 20, '火山'], lake: ['Q23397', 25, '湖泊'], museum: ['Q33506', 30, '博物馆'],
  university: ['Q3918', 40, '大学'], sport: ['Q349', 20, '运动', true], language: ['Q34770', 15, '语言'],
  film: ['Q11424', 70, '电影'], mountain: ['Q8502', 40, '山峰'], river: ['Q4022', 40, '河流'],
  island: ['Q23442', 40, '岛屿'], tvseries: ['Q5398426', 40, '电视剧'],
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('raw/ids', { recursive: true });
fs.mkdirSync('raw/ent', { recursive: true });
async function get(url, accept) {
  for (let t = 0; t < 3; t++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept } });
    const txt = await r.text();
    if (r.status === 200) return txt;
    console.log('  http', r.status, txt.slice(0, 80).replace(/\n/g, ' '));
    await sleep(5000 * (t + 1));
  }
  return null;
}
if (process.argv[1].endsWith('050-fetch.mjs')) {
  const ids = {};
  for (const [k, [q, min, , all]] of Object.entries(CATS)) {
    const f = `raw/ids/${k}.json`;
    if (!fs.existsSync(f)) {
      const sparql = `SELECT ?i ?s WHERE { ?i wdt:P31 wd:${q}; wikibase:sitelinks ?s . FILTER(?s>=${min}) } ${all ? '' : 'ORDER BY RAND()'} LIMIT ${all ? 400 : 260}`;
      const t = await get('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql), 'application/sparql-results+json');
      if (!t) { console.log(k, 'FAILED'); continue; }
      fs.writeFileSync(f, t);
      await sleep(3000);
    }
    ids[k] = JSON.parse(fs.readFileSync(f, 'utf8')).results.bindings.map((r) => r.i.value.split('/').pop());
    console.log(k, ids[k].length);
  }
  const all = [...new Set(Object.values(ids).flat())];
  for (let i = 0; i < all.length; i += 50) {
    const f = `raw/ent/${String(i / 50).padStart(3, '0')}.json`;
    if (fs.existsSync(f)) continue;
    const chunk = all.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=sitelinks|labels|descriptions&languages=en|zh|zh-hans&format=json`;
    const t = await get(url, 'application/json');
    if (!t) { console.log('chunk failed', i); continue; }
    fs.writeFileSync(f, JSON.stringify({ ids: chunk, res: JSON.parse(t) }));
    await sleep(1500);
  }
  fs.writeFileSync('raw/ids.json', JSON.stringify(ids));
  console.log('done', all.length);
}
