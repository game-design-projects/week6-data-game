// Fetch candidate aircraft photos from Wikimedia Commons categories "<type> of <operator> at <airport>".
// Raw API responses cached in raw/. Output: raw/candidates.json
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { AIRPORTS } from './airports.mjs';
const UA = 'daily-data-games/1.0 (NYU class project; lishuyustevenli@gmail.com)';
mkdirSync('raw/api', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(params) {
  const qs = new URLSearchParams({ format: 'json', ...params }).toString();
  const f = `raw/api/${createHash('md5').update(qs).digest('hex')}.json`;
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  for (let i = 0; i < 4; i++) {
    const res = await fetch('https://commons.wikimedia.org/w/api.php?' + qs, { headers: { 'User-Agent': UA } });
    if (res.ok) { const t = await res.text(); writeFileSync(f, t); await sleep(250); return JSON.parse(t); }
    await sleep(2000 * (i + 1));
  }
  throw new Error('api failed ' + qs);
}
const members = async (cat, type, limit = 500) => (await api({ action: 'query', list: 'categorymembers', cmtitle: cat, cmtype: type, cmlimit: String(limit) })).query?.categorymembers ?? [];
// deterministic shuffle
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const out = [];
for (const [iata, cname] of AIRPORTS) {
  const ops = await members(`Category:Aircraft at ${cname} by operator`, 'subcat');
  if (!ops.length) { console.log(iata, 'no operator cats'); continue; }
  const found = [];
  for (const op of shuffle(ops).slice(0, 40)) {
    if (found.length >= 14) break;
    const subs = (await members(op.title, 'subcat', 100)).filter((s) => / of .+ at /.test(s.title));
    if (!subs.length) continue;
    const s = shuffle(subs)[0];
    const m = s.title.match(/^Category:(.+?) of (.+) at (.+)$/);
    if (!m) continue;
    const files = (await members(s.title, 'file', 12)).filter((f) => /\.jpe?g$/i.test(f.title));
    if (!files.length) continue;
    found.push({ iata, type: m[1], operator: m[2], file: shuffle(files)[0].title });
  }
  console.log(iata, found.length);
  out.push(...found);
}
// image info
for (let i = 0; i < out.length; i += 40) {
  const batch = out.slice(i, i + 40);
  const r = await api({ action: 'query', titles: batch.map((b) => b.file).join('|'), prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '640', iiextmetadatafilter: 'DateTimeOriginal|Artist|LicenseShortName|ImageDescription' });
  const norm = Object.fromEntries((r.query.normalized ?? []).map((n) => [n.from, n.to]));
  const pages = Object.values(r.query.pages);
  for (const b of batch) {
    const p = pages.find((x) => x.title === (norm[b.file] ?? b.file));
    const ii = p?.imageinfo?.[0];
    if (!ii) continue;
    const md = ii.extmetadata ?? {};
    Object.assign(b, { thumb: ii.thumburl, page: ii.descriptionurl, w: ii.width, h: ii.height, date: md.DateTimeOriginal?.value, artist: md.Artist?.value, license: md.LicenseShortName?.value, desc: md.ImageDescription?.value });
  }
}
writeFileSync('raw/candidates.json', JSON.stringify(out, null, 1));
console.log('candidates', out.length);
