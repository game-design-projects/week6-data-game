// Fetch Wikidata items with sitelink counts per category (cached in raw/)
import fs from 'node:fs';
const UA = 'DailyDataGames/1.0 (class project; lishuyustevenli@gmail.com)';
const CATS = {
  city: ["Q515","城市"], country: ["Q6256","国家"], film: ["Q11424","电影"], element: ["Q11344","化学元素"],
  videogame: ["Q7889","电子游戏"], album: ["Q482994","专辑"], mountain: ["Q8502","山"], river: ["Q4022","河流"],
  island: ["Q23442","岛屿"], volcano: ["Q8072","火山"], lake: ["Q23397","湖泊"], bigcity: ["Q1549591","大城市"],
  tvseries: ["Q5398426","电视剧"], museum: ["Q33506","博物馆"], university: ["Q3918","大学"], sport: ["Q349","运动"], language: ["Q34770","语言"],
};
for (const [k, [q]] of Object.entries(CATS)) {
  const f = `raw/${k}.json`;
  if (fs.existsSync(f)) continue;
  const sparql = `SELECT ?i ?iLabel ?iDescription ?s WHERE { ?i wdt:P31 wd:${q}; wikibase:sitelinks ?s . FILTER(?s>=3) SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY RAND() LIMIT 150`;
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql);
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
  const t = await r.text();
  if (r.status !== 200) { console.log(k, "FAIL", r.status); continue; }
  fs.writeFileSync(f, t);
  console.log(k, r.status, t.length);
  await new Promise((r) => setTimeout(r, 3000));
}
export { CATS };
