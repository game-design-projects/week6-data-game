// raw/html/*.json (cached Wayback HTML) + ../img/*.webp  ->  ../data.json
// Run from this folder: node fetch.mjs 0/1 && node shoot.mjs && node build.mjs
import fs from 'node:fs'; import { SITES, ABOUT } from './sites.mjs'; import { makeRedactor, BAR } from './redact.mjs';
const NAMED = { raquo: '»', laquo: '«', copy: '©', reg: '®', middot: '·', ndash: '–', mdash: '—', hellip: '…', trade: '™', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', bull: '•', times: '×', rarr: '→', larr: '←', eacute: 'é', egrave: 'è', uuml: 'ü', ouml: 'ö', auml: 'ä', ntilde: 'ñ', iexcl: '¡', iquest: '¿', euro: '€', pound: '£', deg: '°' };
const dec = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => (n === 'amp' || n === 'quot' || n === 'lt' || n === 'gt' || n === 'nbsp' || n === 'apos' ? m : NAMED[n] ?? '')).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/�/g, '').replace(/\s+/g, ' ').trim();
const strip = (s) => dec(s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, ' '));
const count = (h, re) => (h.match(re) || []).length;
const onlyBars = (t) => !t.replace(/[▇\s\W]/g, '');
const out = []; const sites = [];
for (const s of SITES) {
  const [id, name, dom] = s; const red = makeRedactor(s);
  let nsite = 0;
  for (const f of fs.readdirSync('raw/html').filter((f) => f.startsWith(id + '-')).sort()) {
    const r = JSON.parse(fs.readFileSync('raw/html/' + f));
    if (!r.ok || !r.html) continue;
    const h = r.html;
    const title = red(strip((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1])).slice(0, 90);
    const dm = h.match(/<meta[^>]+name=["']?description["']?[^>]*>/i);
    const desc = dm ? red(dec((dm[0].match(/content=["']([^"']*)/i) || [, ''])[1])).slice(0, 160) : '';
    const heads = [...new Set([...h.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => red(strip(m[1]))).filter((t) => t.length > 3 && t.length < 90 && !onlyBars(t)))];
    const links = [...new Set([...h.matchAll(/<a\s[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => red(strip(m[1]))).filter((t) => t.length >= 3 && t.length <= 36 && /[A-Za-z]/.test(t) && !onlyBars(t)))];
    if (links.length < 6 && heads.length < 2) continue;
    const img = fs.existsSync(`../img/${id}-${r.y}.webp`) ? `img/${id}-${r.y}.webp` : null;
    if (!img) { console.log('skip (no screenshot)', id, r.y); continue; }
    const fp = {
      kb: Math.round(Buffer.byteLength(h) / 1024),
      tables: count(h, /<table/gi), fonts: count(h, /<font/gi), imgs: count(h, /<img/gi), scripts: count(h, /<script/gi),
      frames: count(h, /<frameset|<frame /gi), flash: count(h, /\.swf|shockwave-flash|<embed/gi), marquee: count(h, /<marquee|<blink/gi),
      viewport: /name=["']viewport/i.test(h), html5: /^\s*<!doctype html>/i.test(h) || /<(section|article|nav|header|footer)[ >]/i.test(h),
      css: count(h, /rel=["']?stylesheet/gi), fw: ['jquery', 'react', 'bootstrap', 'angular', 'webpack', '__next'].filter((k) => new RegExp(k, 'i').test(h)),
      og: /property=["']og:/i.test(h), https: (h.match(/https:\/\//g) || []).length,
    };
    out.push({ id, y: r.y, ts: r.ts, url: `https://web.archive.org/web/${r.ts}/${r.orig}`, title: onlyBars(title) ? '' : title, desc, heads: heads.slice(0, 8), links: links.slice(0, 40), img, fp });
    nsite++;
  }
  if (nsite) sites.push({ id, name, dom, about: ABOUT[id] || '' });
}
// drop screenshots no puzzle uses
const used = new Set(out.map((x) => x.img.slice(4)));
for (const f of fs.readdirSync('../img')) if (f.endsWith('.webp') && !used.has(f)) fs.unlinkSync('../img/' + f);
fs.writeFileSync('../data.json', JSON.stringify({ sites, snaps: out, built: new Date().toISOString().slice(0, 10) }));
console.log(out.length, 'snaps', sites.length, 'sites', out.filter((x) => x.img).length, 'with image', (fs.statSync('../data.json').size / 1024 | 0) + 'KB');
