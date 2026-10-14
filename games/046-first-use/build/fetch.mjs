// Fetch candidate English Wiktionary entries whose etymology states a first-attestation year.
import fs from 'node:fs';
const UA = 'daily-data-games/1.0 (NYU class project; contact lishuyustevenli@gmail.com)';
const raw = new URL('./raw/', import.meta.url).pathname;
fs.mkdirSync(raw, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = 'https://en.wiktionary.org/w/api.php';
async function api(params) {
  const u = API + '?' + new URLSearchParams({ format: 'json', ...params });
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
const queries = [
  'insource:/[Ff]irst attested in [0-9]{4}/',
  'insource:/[Aa]ttested since [0-9]{4}/',
  'insource:/[Ff]irst attested (from|around|c\\.) [0-9]{4}/',
  'insource:/[Ff]irst recorded in [0-9]{4}/',
  'insource:/[Ff]irst attested in the [0-9]{4}s/',
  'insource:/[Aa]ttested (from|in|as early as|by) (the )?[0-9]{4}/',
  'insource:/\\{\\{(ety|etymon)\\|en\\|[^}]*etydate=1[0-9]{3}[|}]/',
  'insource:/[Ff]irst (recorded|known use|used) (in|around) [0-9]{4}/',
  'insource:/[Ee]arliest (known )?(use|attestation|citation)/ insource:/[0-9]{4}/',
];
const titles = new Set();
for (const q of queries) {
  let off = 0;
  for (;;) {
    const f = `${raw}search-${Buffer.from(q).toString('hex').slice(0, 24)}-${off}.json`;
    let j;
    if (fs.existsSync(f)) j = JSON.parse(fs.readFileSync(f)); else { j = await api({ action: 'query', list: 'search', srsearch: q, srlimit: '50', srnamespace: '0', sroffset: String(off), srprop: '' }); fs.writeFileSync(f, JSON.stringify(j)); await sleep(500); }
    j.query.search.forEach((s) => titles.add(s.title));
    if (!j.continue) break;
    off = j.continue.sroffset;
  }
  console.log(q, titles.size);
}
const list = [...titles].filter((t) => /^[a-z]+$/.test(t)).sort();
console.log('single lowercase words', list.length);
for (let i = 0; i < list.length; i += 50) {
  const f = `${raw}pages-${i}.json`;
  if (fs.existsSync(f)) continue;
  const j = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: list.slice(i, i + 50).join('|') });
  fs.writeFileSync(f, JSON.stringify(j));
  await sleep(700);
}
console.log('done');
