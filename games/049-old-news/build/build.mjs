// raw ALTO XML -> data.json : pick the cleanest text block of each front page, repair OCR hyphenation
// with the ALTO SUBS_CONTENT attribute, mask explicit years, reject snippets that could give the year away.
import fs from 'node:fs'; import path from 'node:path';
const RAW = path.join(import.meta.dirname, 'raw');
const COMMON = new Set('the of and to in a that is was for it with as his he be at by on have from or are this which had not but they were has their been an who will one all would there we her him said no when so more if other than its out up about into after our may can only any them what some time two now very also these over such man new first made before years year upon people state united while under much did must should between during'.split(' '));
const unesc = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;|&gt;/g, '');

export function score(text) {
  const w = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (w.length < 40) return 0;
  const common = w.filter((x) => COMMON.has(x)).length / w.length;
  const real = w.filter((x) => x.length >= 3 && /[aeiouy]/.test(x)).length / w.length;
  const digits = (text.match(/\d/g) || []).length / text.length;
  const upper = (text.match(/[A-Z]/g) || []).length / text.length;
  if (digits > 0.04 || upper > 0.12) return 0;
  return common * 2 + real - 1;
}
/** Mask 4-digit years (incl. OCR-confused digits like 186l) and spelled-out years. */
export function mask(t) {
  return t.replace(/\b1[5-9][\dOoIl]{2}\b/g, '____')
    .replace(/\b(eighteen|nineteen|seventeen)[- ]hundred\b[^.,;]{0,30}/gi, '____');
}
/** Anything that still dates the text explicitly (or sits next to a masked year) disqualifies it. */
export function leaky(t) {
  return /____\s*[-–—\/]\s*\d|\d\s*[-–—\/]\s*____|'[0-9]{2}\b|\bA\.\s?D\.|anno domini|\b(vol|no)\.?\s+[IVXLC\d]+\b|\bnineteen\b|\beighteen\b|\b1[5-9]\d\d\b|\b(mon|tues|wednes|thurs|fri|satur|sun)day,?\s+(jan|feb|mar|apr|may|june?|july?|aug|sept?|oct|nov|dec)/i.test(t);
}
/** [{text, wc}] per TextBlock, joining hyphen-split words through SUBS_CONTENT. */
export function blocks(xml) {
  const out = [];
  for (const m of xml.matchAll(/<TextBlock\b[\s\S]*?<\/TextBlock>/g)) {
    const words = []; let wcs = 0, n = 0;
    for (const s of m[0].matchAll(/<String\b([^>]*)\/?>/g)) {
      const a = s[1];
      const c = a.match(/CONTENT="([^"]*)"/)?.[1]; if (c == null) continue;
      const wc = Number(a.match(/\bWC="([\d.]+)"/)?.[1] ?? 0.5);
      const st = a.match(/SUBS_TYPE="(\w+)"/)?.[1]; const sc = a.match(/SUBS_CONTENT="([^"]*)"/)?.[1];
      wcs += wc; n++;
      if (st === 'HypPart1' && sc) words.push(sc); else if (st === 'HypPart2') continue; else words.push(c);
    }
    out.push({ text: unesc(words.join(' ')).replace(/\s+/g, ' ').trim(), wc: n ? wcs / n : 0 });
  }
  return out;
}
export function cleanTitle(t) {
  return t.replace(/\s*,?\s*[A-Z][a-z]+\.? \d{1,2}, \d{4}.*$/, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+,/g, ',').trim();
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const items = []; const rej = { noblock: 0, leaky: 0 };
  for (const f of fs.readdirSync(RAW).filter((x) => x.startsWith('m-'))) {
    const meta = JSON.parse(fs.readFileSync(path.join(RAW, f)));
    const ap = path.join(RAW, `a-${meta.id}.xml`);
    if (!fs.existsSync(ap)) continue;
    const year = Number(meta.date.slice(0, 4));
    const paper = cleanTitle(meta.title);
    let best = null;
    for (const b of blocks(fs.readFileSync(ap, 'utf8'))) {
      let t = b.text;
      if (t.length < 300 || b.wc < 0.72) continue;
      if (t.length > 520) { const cut = t.lastIndexOf('. ', 520); t = t.slice(0, cut > 250 ? cut + 1 : 520); }
      t = mask(t);
      if (leaky(t)) { rej.leaky++; continue; }
      // never let the masthead leak: paper name or city inside the snippet
      const low = t.toLowerCase();
      if (paper.length > 6 && low.includes(paper.toLowerCase())) continue;
      const s = score(t) + b.wc;
      if (score(t) > 0.55 && (!best || s > best.s)) best = { s, t };
    }
    if (!best) { rej.noblock++; continue; }
    items.push({ id: meta.id, year, date: meta.date, paper, place: [meta.city, meta.state].filter(Boolean).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())).join(', '), url: meta.url, text: best.t });
  }
  items.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), items }));
  const per = {}; for (const i of items) per[Math.floor(i.year / 10) * 10] = (per[Math.floor(i.year / 10) * 10] || 0) + 1;
  console.log(items.length, 'snippets', items[0]?.year, items.at(-1)?.year, JSON.stringify(rej), JSON.stringify(per));
}
