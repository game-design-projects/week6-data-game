import { SEEDS } from './seeds.mjs';
import fs from 'node:fs';
const UA = 'daily-data-games/1.0 (class project; contact lishuyustevenli@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [prop, qid] of SEEDS) {
  const f = `raw/${prop}_${qid}.json`;
  if (fs.existsSync(f)) continue;
  const q = `SELECT ?item ?zh ?en ?sl WHERE { ?item wdt:${prop} wd:${qid}; wikibase:sitelinks ?sl. ?item rdfs:label ?zh. FILTER(LANG(?zh) IN ("zh-hans","zh-cn","zh-sg")) FILTER NOT EXISTS{?item wdt:P576 ?dd} ${prop==="P47"?"?item wdt:P31 wd:Q6256.":""} OPTIONAL{?item rdfs:label ?en. FILTER(LANG(?en)="en")} } ORDER BY DESC(?sl) LIMIT 60`;
  const lq = `SELECT ?zh ?en WHERE { OPTIONAL{wd:${qid} rdfs:label ?zh. FILTER(LANG(?zh)="zh")} wd:${qid} rdfs:label ?en. FILTER(LANG(?en)="en") }`;
  const out = {};
  for (const [k, qq] of [['items', q], ['label', lq]]) {
    for (let t = 0; t < 3; t++) {
      const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(qq), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
      if (r.ok) { out[k] = (await r.json()).results.bindings; break; }
      console.error(prop, qid, r.status); await sleep(5000);
    }
    await sleep(1200);
  }
  fs.writeFileSync(f, JSON.stringify(out));
  console.log(prop, qid, out.items?.length);
}
