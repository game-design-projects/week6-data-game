// raw Wikidata responses -> ../data.json  (node build.mjs; run fetch.mjs first)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(here, 'raw');
const LANGS = 'de,nl,sv,da,fr,es,it,pt,ro,ru,pl,cs,el,hi,fa,ar,tr,fi,hu,sw,id,ja,zh,ko,he,vi'.split(',');
const TIER1 = 'zh,ja,ko,ar,he,vi,sw,fi,hu,tr,id'.split(',');

/** Clean one Wikidata label: single token (Vietnamese may have 2 syllables), no brackets/commas, first letter lowercased. */
// polysemous / odd English headwords that make an unfair puzzle
const EXCLUDE = new Set('cold match lead square fisher border heat size shape season lie crowd century'.split(' '));

export function cleanLabel(v, lang) {
  if (!v) return null;
  v = v.trim();
  if (!v || v.length > 16 || /[(),;:\/\d]/.test(v)) return null;
  const words = v.split(/\s+/).length;
  if (words > (lang === 'vi' ? 2 : 1)) return null;
  return v.charAt(0).toLowerCase() + v.slice(1);
}

export function build(files) {
  const byEn = new Map();
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const e of Object.values(j.entities || {})) {
      const L = e.labels || {};
      const en = L.en?.value;
      if (!en || !/^[A-Za-z]{3,12}$/.test(en)) continue;
      if (/disambiguation|Wikimedia|given name|family name|surname|\b(order|family|genus|species|class|clade|suborder) (of|in)\b/i.test(e.descriptions?.en?.value || '')) continue;
      if (EXCLUDE.has(en.toLowerCase())) continue;
      const l = {};
      for (const k of LANGS) { const v = cleanLabel(L[k]?.value, k); if (v) l[k] = v; }
      if (!byEn.has(en.toLowerCase())) byEn.set(en.toLowerCase(), { q: e.id, en: en.toLowerCase(), l });
    }
  }
  let concepts = [...byEn.values()];
  // a label shared by two concepts in one language is ambiguous -> drop it from both
  for (const k of LANGS) {
    const cnt = new Map();
    for (const c of concepts) if (c.l[k]) cnt.set(c.l[k], (cnt.get(c.l[k]) || 0) + 1);
    for (const c of concepts) if (c.l[k] && cnt.get(c.l[k]) > 1) delete c.l[k];
  }
  concepts = concepts.filter((c) => Object.keys(c.l).length >= 18 && TIER1.filter((k) => c.l[k]).length >= 5);
  concepts.sort((a, b) => a.en.localeCompare(b.en));
  return concepts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = fs.readdirSync(raw).filter((f) => f.startsWith('wd2-')).sort().map((f) => path.join(raw, f));
  const concepts = build(files);
  const out = path.join(here, '..', 'data.json');
  fs.writeFileSync(out, JSON.stringify({ concepts }));
  console.log(concepts.length, 'concepts', fs.statSync(out).size, 'bytes');
}
