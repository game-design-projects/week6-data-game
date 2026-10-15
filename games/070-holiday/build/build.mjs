#!/usr/bin/env node
// Builds data.json for Holiday from Nager.Date (run build/fetch.sh first) + GeoNames.
//   ./build/fetch.sh 2026 && node build/build.mjs 2026
// Only holidays with type "Public" (statutory) are kept. For every country we also precompute `terms`:
// stems of the country's / capital's name in dozens of languages, used by game.js to black out
// anything that would name the country before the guess.
import { readFile, writeFile, readdir } from 'node:fs/promises';

const YEAR = process.argv[2] ?? '2026';
const here = new URL('.', import.meta.url);
const raw = (f) => readFile(new URL(`raw/${f}`, here), 'utf8');

export const strip = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const GENERIC = new Set(['republic', 'republique', 'republica', 'republik', 'republika', 'repubblica', 'island', 'islands', 'islas', 'iles', 'isole', 'inseln', 'eilanden', 'united', 'states', 'estados', 'unidos', 'unies', 'etats', 'south', 'north', 'central', 'african', 'saint', 'sint', 'santa', 'city', 'ciudad', 'stadt', 'cabo', 'della', 'kingdom', 'democratic', 'federal', 'territory', 'territoire', 'british', 'french', 'dutch', 'special', 'administrative', 'region', 'province', 'autonomous', 'peoples', 'people', 'national', 'independent', 'state', 'land', 'port', 'town', 'west', 'east', 'new', 'grand', 'great', 'little', 'mont', 'monte', 'ville', 'villa', 'pais', 'paises', 'bajos', 'bass', 'wallis', 'futuna', 'sahara', 'nord', 'sud', 'norte', 'este', 'oeste', 'north']);
const LANGS = 'en fr es de pt ru ar it nl tr zh ja ko sv da nb fi pl cs sk hu ro bg sr hr sl uk el he fa id ms vi th sw hi bn ur ka hy az kk et lv lt mk sq bs is mt ga cy ca eu gl lb af am ne si ta mn uz ky tg tk ps ku so ha yo zu rw ln mg ht sm to fj tpi bi'.split(' ');

function words(s) { return (s.match(/[\p{L}\p{M}]+/gu) ?? []); }
// minLen: stems shorter than this are dropped (foreign-language names need ≥ 5 letters so that
// accidental 4-letter stems like "dans" do not blank out ordinary words)
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
// demonyms / adjectives that no translation of the country name yields
const EXTRA = { BD: ['bengal', 'bangla'], KH: ['khmer'], GR: ['greek', 'hellen'], CY: ['cypriot'], NZ: ['maori'], AU: ['aussie'], IE: ['irish'], NL: ['dutch'], DK: ['danish'], FI: ['finnish'], PL: ['polish'], ES: ['spanish'], TR: ['turkish'], GB: ['british', 'english'], FR: ['french'], SE: ['swedish'], NO: ['norwegian'], PH: ['filipino'], TH: ['thai'], JP: ['japanese'], PE: ['peruvian'], BR: ['brazilian'], MX: ['mexican'] };
function stemsOf(name, minLen = 4) {
  const out = [];
  for (const w of words(name)) {
    if (CJK.test(w)) { if (w.length >= 2) out.push(w.toLowerCase()); continue; }
    const k = strip(w);
    if (k.length < 4 || GENERIC.has(k)) continue;
    const s = k.length > 5 ? k.slice(0, k.length - 2) : k;
    if (s.length >= minLen) out.push(s);
  }
  return out;
}

const info = new Map();
for (const l of (await raw('countryInfo.txt')).split('\n')) {
  if (!l || l[0] === '#') continue;
  const c = l.split('\t');
  info.set(c[0], { name: c[4], capital: c[5], langs: (c[15] ?? '').split(',').map((x) => x.split('-')[0]).filter(Boolean) });
}
const caps = new Map();
for (const l of (await raw('cities15000.txt')).split('\n')) {
  const c = l.split('\t');
  if (c[7] === 'PPLC' && !caps.has(c[8])) caps.set(c[8], { name: c[2], ascii: c[1], alts: (c[3] ?? '').split(','), lat: +(+c[4]).toFixed(3), lng: +(+c[5]).toFixed(3) });
}
const names = new Map(JSON.parse(await raw('countries.json')).map((c) => [c.countryCode, c.name]));

const countries = [];
for (const f of (await readdir(new URL('raw/holidays/', here))).filter((f) => f.startsWith(YEAR))) {
  const cc = f.slice(5, 7);
  const list = JSON.parse(await raw(`holidays/${f}`)).filter((x) => x.types?.includes('Public'));
  const byDate = new Map();
  for (const x of list) {
    const k = x.date.slice(5);
    const cur = byDate.get(k);
    if (!cur) byDate.set(k, { d: k, name: x.name, local: x.localName, global: x.global !== false });
    else {
      if (x.global !== false) cur.global = true;
      if (!cur.name.split(' / ').includes(x.name)) cur.name += ` / ${x.name}`;
      if (!cur.local.split(' / ').includes(x.localName)) cur.local += ` / ${x.localName}`;
    }
  }
  const hol = [...byDate.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
  const cap = caps.get(cc);
  if (hol.length < 5 || !cap) continue;
  const nm = names.get(cc) ?? info.get(cc)?.name ?? cc;
  // names of the country in many languages
  const set = new Set([...stemsOf(nm), ...stemsOf(info.get(cc)?.name ?? ''), ...(EXTRA[cc] ?? [])]);
  const own = new Set(info.get(cc)?.langs ?? []);
  for (const lg of new Set([...own, ...LANGS])) {
    try { for (const s of stemsOf(new Intl.DisplayNames([lg], { type: 'region', fallback: 'none' }).of(cc) ?? '', own.has(lg) || lg === 'en' ? 4 : 5)) set.add(s); } catch { /* unknown language */ }
  }
  // capital: its names + any alternate spelling that actually occurs in this country's holiday names
  const text = new Set(hol.flatMap((h) => words(`${h.name} ${h.local}`).map(strip)));
  for (const n of [cap.name, cap.ascii, info.get(cc)?.capital ?? '']) for (const s of stemsOf(n)) set.add(s);
  for (const a of cap.alts) for (const w of words(a)) { const k = strip(w); if (k.length >= 4 && text.has(k)) for (const s of stemsOf(w)) set.add(s); }
  countries.push({ cc, name: nm, capital: { name: cap.name, lat: cap.lat, lng: cap.lng }, terms: [...set].sort(), holidays: hol });
}
// in how many countries does each (English) holiday name occur → clue ordering generic → specific
const freq = new Map();
const key = (n) => n.toLowerCase();
for (const c of countries) for (const n of new Set(c.holidays.flatMap((h) => h.name.split(' / ').map(key)))) freq.set(n, (freq.get(n) ?? 0) + 1);
for (const c of countries) for (const h of c.holidays) h.common = Math.min(...h.name.split(' / ').map((n) => freq.get(key(n))));

// drop stems that are prefixes of everyday holiday vocabulary (≥ 8 countries use the word)
const vocab = new Map();
for (const c of countries) for (const w of new Set(c.holidays.flatMap((h) => words(`${h.name} ${h.local}`).map(strip)))) vocab.set(w, (vocab.get(w) ?? 0) + 1);
const common = [...vocab].filter(([, n]) => n >= 8).map(([w]) => w);
for (const c of countries) c.terms = c.terms.filter((t) => !common.some((w) => w.startsWith(t) && t.length < w.length));

// which countries may be the daily answer: not a dependency / tiny territory, and ≥ 6 statutory holidays.
// (Every country stays selectable as a guess.)
const DEPENDENCIES = new Set('AI AW AX BL BM BQ CC CK CW CX FK FO GF GG GI GL GP IM JE KY MF MP MQ MS NC NF NU PF PM PN PR SH SJ SX TC VG VI WF'.split(' '));
for (const c of countries) c.play = !DEPENDENCIES.has(c.cc) && c.holidays.length >= 6;

const out = JSON.stringify({ year: +YEAR, source: 'Nager.Date v3 (Public holidays) + GeoNames', countries });
await writeFile(new URL('../data.json', here), out);
console.log(`holiday: ${countries.length} countries (${countries.filter((c) => c.play).length} playable), ${(out.length / 1024).toFixed(0)} KB`);
