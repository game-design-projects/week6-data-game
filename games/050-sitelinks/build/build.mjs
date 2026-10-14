// raw/*.json (Wikidata SPARQL results) -> ../data.json
import fs from 'node:fs';
const ZH = { city: '城市', country: '国家', film: '电影', element: '化学元素', videogame: '电子游戏', album: '专辑', mountain: '山峰', river: '河流', island: '岛屿', volcano: '火山', lake: '湖泊', bigcity: '大城市', tvseries: '电视剧', museum: '博物馆', university: '大学', sport: '运动', language: '语言' };
const cats = [];
for (const f of fs.readdirSync('raw').filter((x) => x.endsWith('.json')).sort()) {
  const key = f.replace('.json', '');
  if (!ZH[key]) continue;
  const rows = JSON.parse(fs.readFileSync('raw/' + f, 'utf8')).results.bindings;
  const seen = new Set();
  const items = [];
  for (const r of rows) {
    const id = r.i.value.split('/').pop();
    const name = r.iLabel?.value;
    if (!name || /^Q\d+$/.test(name) || seen.has(name)) continue;
    seen.add(name);
    items.push({ id, name, desc: (r.iDescription?.value || '').slice(0, 70), n: Number(r.s.value) });
  }
  if (items.length >= 30) cats.push({ key, zh: ZH[key], items: items.slice(0, 120) });
  console.log(key, items.length);
}
fs.writeFileSync('../data.json', JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), cats }));
console.log('cats', cats.length, fs.statSync('../data.json').size);
