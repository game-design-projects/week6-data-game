// Downloads raw Wikidata SPARQL results into build/raw/ (cached). Run: node fetch.mjs  (from build/)
import { SEEDS, KINDS } from './seeds.mjs';
import fs from 'node:fs';
const UA = 'daily-data-games/1.0 (NYU class project; lishuyustevenli@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function sparql(q) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
    if (r.ok) return (await r.json()).results.bindings;
    console.error('  http', r.status); await sleep(6000 * (t + 1));
  }
  return null;
}
const resolved = fs.existsSync('raw/resolve.json') ? JSON.parse(fs.readFileSync('raw/resolve.json')) : {};
const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, '_');
for (const [kind, en] of SEEDS) {
  const K = KINDS[kind];
  const f = `raw/${kind}_${slug(en)}.json`;
  if (fs.existsSync(f)) continue;
  let res = resolved[`${kind}|${en}`];
  if (!res) {
    const ent = kind === 'border' ? 'wd:Q6256' : 'wd:Q5 wd:Q215380';
    const rq = `SELECT ?q ?sl ?d WHERE { ?q rdfs:label "${en.replace(/"/g, '\\"')}"@en; wikibase:sitelinks ?sl. ${kind === 'game' ? '' : `?q wdt:P31/wdt:P279* ?t. VALUES ?t {${ent}}`} OPTIONAL{?q schema:description ?d. FILTER(LANG(?d)="en")} } ORDER BY DESC(?sl) LIMIT 5`;
    const cands = await sparql(rq); await sleep(1200);
    if (!cands?.length) { console.warn('unresolved', en); continue; }
    res = { qid: cands[0].q.value.split('/').pop(), desc: cands[0].d?.value, cands: cands.map((c) => [c.q.value.split('/').pop(), +c.sl.value]) };
    resolved[`${kind}|${en}`] = res; fs.writeFileSync('raw/resolve.json', JSON.stringify(resolved));
  }
  const qid = res.qid;
  const typeVals = `VALUES ?t {${K.type}}`;
  const q = `SELECT ?item ?zh ?sl ?en (MIN(YEAR(?dt)) AS ?y) WHERE { ?item wdt:${K.prop} wd:${qid}; ${K.direct ? 'wdt:P31' : 'wdt:P31/wdt:P279*'} ?t; wikibase:sitelinks ?sl. ${typeVals}
    ?item rdfs:label ?zh. FILTER(LANG(?zh) IN ("zh-hans","zh-cn","zh-sg"))
    ${kind === 'border' ? 'FILTER NOT EXISTS{?item wdt:P576 ?dd}' : ''}
    OPTIONAL{?item rdfs:label ?en. FILTER(LANG(?en) IN ("en","mul"))}
    OPTIONAL{?item wdt:${kind === 'art' ? 'P571' : 'P577'} ?dt} } GROUP BY ?item ?zh ?sl ?en ORDER BY DESC(?sl) LIMIT 70`;
  const items = await sparql(q); await sleep(1200);
  if (!items) { console.warn('failed', en); continue; }
  fs.writeFileSync(f, JSON.stringify({ kind, en, qid, desc: res.desc, cands: res.cands, items }));
  console.log(kind, en, qid, res.desc, items.length);
}
