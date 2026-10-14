// raw ALTO XML -> data.json : pick readable text blocks, mask explicit years.
import fs from 'node:fs'; import path from 'node:path';
const RAW = path.join(import.meta.dirname, 'raw');
const COMMON = new Set('the of and to in a that is was for it with as his he be at by on have from or are this which had not but they were has their been an who will one all would there we her him said no when so more if other than its out up about into after our may can only any them what some time two now very also these over such man new first made before years year upon people state united while under said mr much did must should between during'.split(' '));
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
export function mask(t) { return t.replace(/\b(1[5-9]\d\d)\b/g, '____').replace(/\b(1[5-9]\d\d)(?=\D)/g, '____'); }
function blocks(xml) {
  const out = [];
  for (const m of xml.matchAll(/<TextBlock\b[\s\S]*?<\/TextBlock>/g)) {
    const lines = [...m[0].matchAll(/<TextLine\b[\s\S]*?<\/TextLine>/g)].map((l) => [...l[0].matchAll(/CONTENT="([^"]*)"/g)].map((c) => c[1]).join(' '));
    let t = lines.join(' ').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;|&gt;/g, '').replace(/(\w)- (\w)/g, '$1$2').replace(/\s+/g, ' ').trim();
    out.push(t);
  }
  return out;
}
const items = [];
for (const f of fs.readdirSync(RAW).filter((x) => x.startsWith('m-'))) {
  const meta = JSON.parse(fs.readFileSync(path.join(RAW, f)));
  const ap = path.join(RAW, `a-${meta.id}.xml`);
  if (!fs.existsSync(ap)) continue;
  let best = null;
  for (let t of blocks(fs.readFileSync(ap, 'utf8'))) {
    if (t.length < 280) continue;
    // trim to whole sentence-ish window of <= 520 chars
    if (t.length > 520) { const cut = t.lastIndexOf('. ', 520); t = t.slice(0, cut > 250 ? cut + 1 : 520); }
    const s = score(t);
    if (s > 0.55 && (!best || s > best.s)) best = { s, t };
  }
  if (!best) continue;
  const year = Number(meta.date.slice(0, 4));
  items.push({ id: meta.id, year, date: meta.date, paper: meta.title.replace(/\s*,?\s*[A-Z][a-z]+\.? \d{1,2}, \d{4}.*$/, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+,/g, ',').trim(), place: [meta.city, meta.state].filter(Boolean).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())).join(', '), url: meta.url, text: mask(best.t) });
}
items.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), items }));
console.log(items.length, 'snippets', items[0]?.year, items.at(-1)?.year);
