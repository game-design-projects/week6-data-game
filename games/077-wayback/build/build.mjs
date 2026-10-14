import fs from 'node:fs'; import { SITES } from './sites.mjs';
const dec = (s) => s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/\s+/g,' ').trim();
const strip = (s) => dec(s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi,' '));
const count = (h, re) => (h.match(re) || []).length;
const out = []; const sites = [];
for (const [id, name, dom, extra] of SITES) {
  const base = dom.split('.')[0].replace(/-/g, '');
  const words = [...new Set([base, dom, name.replace(/[^\w ]/g,'').trim(), ...extra].filter(w => w && w.length > 2))].sort((a,b)=>b.length-a.length);
  const re = new RegExp(words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'[\\s-]*')).join('|') + '\\w*', 'gi');
  const red = (s) => s.replace(re, '▇▇▇');
  let nsite = 0;
  for (const f of fs.readdirSync('raw/html').filter(f => f.startsWith(id + '-'))) {
    const r = JSON.parse(fs.readFileSync('raw/html/' + f));
    if (!r.ok || !r.html) continue;
    const h = r.html;
    const title = red(strip((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [,''])[1])).slice(0, 90);
    const dm = h.match(/<meta[^>]+name=["']?description["']?[^>]*>/i);
    const desc = dm ? red(dec((dm[0].match(/content=["']([^"']*)/i) || [,''])[1])).slice(0, 160) : '';
    const heads = [...h.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => red(strip(m[1]))).filter(t => t.length > 3 && t.length < 90 && !/^[▇\s]+$/.test(t));
    const links = [...new Set([...h.matchAll(/<a\s[^>]*>([\s\S]*?)<\/a>/gi)].map(m => red(strip(m[1]))).filter(t => t.length >= 3 && t.length <= 36 && /[A-Za-z]/.test(t) && !/^[▇\s]+$/.test(t)))];
    if (links.length < 6 && heads.length < 2) continue;
    const fp = {
      kb: Math.round(Buffer.byteLength(h) / 1024),
      tables: count(h, /<table/gi), fonts: count(h, /<font/gi), imgs: count(h, /<img/gi), scripts: count(h, /<script/gi),
      frames: count(h, /<frameset|<frame /gi), flash: count(h, /\.swf|shockwave-flash|<embed/gi), marquee: count(h, /<marquee|<blink/gi),
      iframes: count(h, /<iframe/gi), viewport: /name=["']viewport/i.test(h), html5: /^\s*<!doctype html>/i.test(h) || /<(section|article|nav|header|footer)[ >]/i.test(h),
      css: count(h, /rel=["']?stylesheet/gi), fw: ['jquery','react','bootstrap','angular','webpack','__next'].filter(k => new RegExp(k, 'i').test(h)),
      og: /property=["']og:/i.test(h), https: (h.match(/https:\/\//g) || []).length,
    };
    out.push({ id, y: r.y, ts: r.ts, url: `https://web.archive.org/web/${r.ts}/${r.orig}`, title, desc, heads: heads.slice(0, 8), links: links.slice(0, 40), fp });
    nsite++;
  }
  if (nsite) sites.push({ id, name, dom });
}
fs.writeFileSync('../data.json', JSON.stringify({ sites, snaps: out, built: new Date().toISOString().slice(0,10) }));
console.log(out.length, 'snaps', sites.length, 'sites', (fs.statSync('../data.json').size/1024|0)+'KB');
