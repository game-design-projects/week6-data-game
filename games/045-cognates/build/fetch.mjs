// Fetch Wikidata labels for everyday concepts (by enwiki title) in 26 languages. Raw responses cached in raw/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OLD, NEW } from './titles.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(here, 'raw'); fs.mkdirSync(raw, { recursive: true });
export const LANGS = 'de,nl,sv,da,fr,es,it,pt,ro,ru,pl,cs,el,hi,fa,ar,tr,fi,hu,sw,id,ja,zh,ko,he,vi,en'.split(',');
const uniq = [...new Set((OLD + ',' + NEW).split(',').map((s) => s.trim()).filter(Boolean))];
for (let i = 0; i < uniq.length; i += 40) {
  const f = path.join(raw, `wd2-${i}.json`);
  if (fs.existsSync(f)) continue;
  const t = uniq.slice(i, i + 40);
  const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&format=json&props=labels|sitelinks|descriptions&languages=' + LANGS.join('|') + '&titles=' + encodeURIComponent(t.join('|'));
  const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (NYU class project; cognates)' } });
  const txt = await r.text();
  fs.writeFileSync(f, txt);                      // save raw before parsing
  console.log('fetched', i, r.status, txt.length);
  await new Promise((r) => setTimeout(r, 8000));
}
console.log('done', uniq.length, 'titles');
