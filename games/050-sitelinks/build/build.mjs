// raw/ids + raw/ent (Wikidata API) -> ../data.json
// n = number of Wikipedia language editions (sitelinks ending in "wiki", minus non-Wikipedia wikis).
import fs from 'node:fs';
import { CATS } from './050-fetch.mjs';

const NON_WP = new Set(['commonswiki', 'wikidatawiki', 'specieswiki', 'metawiki', 'mediawikiwiki', 'incubatorwiki',
  'outreachwiki', 'foundationwiki', 'abstractwiki', 'wikifunctionswiki', 'sourceswiki', 'testwiki', 'test2wiki',
  'testwikidatawiki', 'strategywiki', 'usabilitywiki', 'nostalgiawiki', 'wikimaniawiki', 'labswiki', 'donatewiki', 'tenwiki']);
// the 10 largest Wikipedias; used for the "who covers it" teaching line
export const TOP = ['en', 'de', 'fr', 'es', 'ru', 'ja', 'zh', 'it', 'pt', 'ar'];

export function wpCodes(sitelinks) {
  return Object.keys(sitelinks || {}).filter((k) => k.endsWith('wiki') && !NON_WP.has(k)).map((k) => k.slice(0, -4).replace(/_/g, '-'));
}
const cleanDesc = (d) => {
  d = (d || '').replace(/\s+/g, ' ').trim();
  if (d.length <= 80) return d;
  const cut = d.slice(0, 80);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
};

export function buildItem(id, e) {
  const name = e.labels?.en?.value;
  if (!name || /^Q\d+$/.test(name)) return null;
  const codes = wpCodes(e.sitelinks);
  const zh = (e.labels?.['zh-hans'] || e.labels?.zh)?.value;
  const desc = cleanDesc(e.descriptions?.en?.value);
  return {
    id, name, zh: zh && zh !== name ? zh : '', desc, n: codes.length,
    top: TOP.filter((c) => codes.includes(c)).length,
    miss: TOP.filter((c) => !codes.includes(c)),
  };
}

if (process.argv[1].endsWith('build.mjs')) {
  const ids = JSON.parse(fs.readFileSync('raw/ids.json', 'utf8'));
  const ent = {};
  for (const f of fs.readdirSync('raw/ent').sort()) Object.assign(ent, JSON.parse(fs.readFileSync('raw/ent/' + f, 'utf8')).res.entities);
  const cats = [];
  for (const [key, [, , zh]] of Object.entries(CATS)) {
    const seen = new Set();
    const items = [];
    for (const id of ids[key] || []) {
      const e = ent[id];
      if (!e || e.missing !== undefined) continue;
      const it = buildItem(id, e);
      if (!it || !it.desc || it.n < 12 || seen.has(it.name.toLowerCase())) continue;
      if (/wikipedia|disambiguation/i.test(it.desc)) continue;
      if (key === 'element' && !/^chemical element/i.test(it.desc)) continue;
      if (key === 'language' && /^(language family|group of|dialect)/i.test(it.desc)) continue;
      seen.add(it.name.toLowerCase());
      items.push(it);
    }
    items.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
    console.log(key, ids[key]?.length, '->', items.length, 'n range', Math.min(...items.map((i) => i.n)), Math.max(...items.map((i) => i.n)));
    if (items.length >= 40) cats.push({ key, zh, items: items.slice(0, 150) });
  }
  fs.writeFileSync('../data.json', JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), top: TOP, cats }));
  console.log('cats', cats.length, fs.statSync('../data.json').size, 'bytes');
}
