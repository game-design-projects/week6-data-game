// Step 2: stream the 24 hourly Wikimedia pageview dumps of one day, keep only lines for our game articles.
// Raw (filtered) hours are cached in raw/h-HH.tsv; the 60 MB dumps themselves are never stored.
import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { Readable } from 'node:stream';
const DAY = process.argv[2] || '20260915';
const UA = 'daily-data-games/1.0 (class project; lishuyustevenli@gmail.com)';
const titles = JSON.parse(fs.readFileSync('raw/titles.json', 'utf8'));
const want = new Map(); // "lang title_underscored" -> enTitle|lang
for (const [en, t] of Object.entries(titles)) for (const [lang, ti] of Object.entries(t)) want.set(`${lang} ${ti.replace(/ /g, '_')}`, `${en}|${lang}`);
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, '0');
  const f = `raw/h-${DAY}-${hh}.tsv`;
  if (fs.existsSync(f)) continue;
  const url = `https://dumps.wikimedia.org/other/pageviews/${DAY.slice(0, 4)}/${DAY.slice(0, 4)}-${DAY.slice(4, 6)}/pageviews-${DAY}-${hh}0000.gz`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const rl = readline.createInterface({ input: Readable.fromWeb(res.body).pipe(zlib.createGunzip()) });
  const out = [];
  for await (const line of rl) {
    const sp = line.split(' ');
    const dom = sp[0];
    const lang = dom.endsWith('.m') ? dom.slice(0, -2) : dom; // "en" = desktop, "en.m" = mobile Wikipedia
    if (lang.includes('.')) continue; // other projects (en.b, en.d …)
    const key = `${lang} ${dec(sp[1])}`;
    const k = want.get(key);
    if (k) out.push(`${k}\t${sp[2]}`);
  }
  fs.writeFileSync(f, out.join('\n'));
  console.log('hour', hh, out.length, 'lines');
}
