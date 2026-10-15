// raw (build/raw/*.r3.json.gz) -> ../data.json.  Run from build/:  node build.mjs
// For each city: find every OSM node shared by >= 3 differently-named roads, then pick the junction with
// the most distinct names (max 6), preferring junctions that do not spell the city's or country's name.
import fs from 'node:fs'; import zlib from 'node:zlib'; import { fileURLToPath } from 'node:url'; import cities from './cities.mjs';

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const DIR = /\b(north|south|east|west|northwest|northeast|southwest|southeast|upper|lower|nord|sud|est|ouest|norte|sur|este|oeste)\b/gi;
/** identity key of a street name: no direction/Upper/Lower words, no punctuation */
const ABBR = { dr: 'doctor', av: 'avenida', avda: 'avenida', bul: 'bulevar', str: 'strada', st: 'street', ave: 'avenue', gen: 'general', prof: 'profesor' };
export const baseKey = (n) => fold(n).replace(DIR, ' ').replace(/([a-z])(\d)/g, '$1 $2').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').map((w) => ABBR[w] || w).join(' ');
const compact = (n) => baseKey(n).replace(/ /g, '');
const GENERIC = new Set(['calle', 'avenida', 'rua', 'rue', 'street', 'road', 'avenue', 'via', 'strada', 'carrer', 'jiron', 'carrera', 'prolongacion', 'jalan', 'ulica', 'bulevar']);
const tokens = (n) => baseKey(n).split(' ').filter((w) => w && !GENERIC.has(w));
/** OSM data glitches: connectors/flyovers, plus a few placeholder or duplicate spellings found by hand. */
const BAD_NAME = /connector|flyover|elevated|underpass|tunnel|garage|parking|\bexit\b|\bramp\b/i;
const EXCLUDE_NAMES = new Set(['नील सरसवती मार्ग', 'SHN Quadra 1', 'გ. ჩიტაიას ქუჩა']);
/** Cities whose OSM street names are placeholders ("Street 4"), so no readable puzzle exists. */
export const SKIP_CITIES = new Set(['Lahore']);

/** Distinct-name junction nodes. ways: [{n, en?, h?, g:[[lat,lng]…]}] */
export function findJunctions(ways, min = 4) {
  const m = new Map();
  for (const w of ways) {
    if (!w.g || !w.n) continue;
    for (const [la, lo] of w.g) {
      const k = la.toFixed(6) + ',' + lo.toFixed(6);
      let e = m.get(k); if (!e) m.set(k, e = { lat: la, lng: lo, names: new Map() });
      if (!e.names.has(w.n)) e.names.set(w.n, w.en || null);
    }
  }
  const out = [];
  for (const e of m.values()) {
    if (e.names.size < min) continue;
    const ns = [...e.names.keys()].filter((n) => !/[()]/.test(n) && !BAD_NAME.test(n) && !EXCLUDE_NAMES.has(n));
    const keep = [];
    for (const n of ns) {
      const k = baseKey(n), en = e.names.get(n);
      const dup = ns.some((o) => {
        if (o === n) return false;
        const ko = baseKey(o), eo = e.names.get(o);
        if (ko === k) return o < n;                                   // same street after dropping North/Upper…
        if (ko.length >= 4 && ko.length < k.length && k.includes(ko)) return true; // "Hướng đi X" / "X (Mặt sau)" style duplicates
        const to = tokens(o), tn = tokens(n);
        if (to.length && to.length <= tn.length && (to.length < tn.length || o < n) && to.every((w) => tn.includes(w))) return true; // "Calle Colón" ⊂ "Calle Cristóbal Colón"
        if (compact(o).length >= 6 && compact(o).length < compact(n).length && compact(n).includes(compact(o))) return true; // "DOHS Main Road" ⊂ "Baridhara D.O.H.S Main Road"
        if ((en && eo && baseKey(en) === baseKey(eo) && o < n) || (en && baseKey(en) === ko) ) return true; // same street in two scripts
        return false;
      });
      if (!dup) keep.push(n);
    }
    if (keep.length >= min) out.push({ lat: e.lat, lng: e.lng, names: new Map(keep.map((n) => [n, e.names.get(n)])) });
  }
  return out;
}

/** The city's name in its own language(s) — a street called "Wiener Straße" or "Москва" would give it away. */
export const ENDONYMS = { Vienna: ['Wien'], Prague: ['Praha'], Munich: ['München', 'Muenchen'], Cologne: ['Köln'], Rome: ['Roma'], Warsaw: ['Warszawa'], Copenhagen: ['København'], Lisbon: ['Lisboa'], Moscow: ['Москва', 'Moskva'], Kyiv: ['Київ', 'Киев', 'Kiev'], Athens: ['Αθήνα', 'Αθηνών', 'Athína'], Tokyo: ['\u6771\u4eac', '\u4e1c\u4eac'], Seoul: ['서울', '\u9996\u5c14'], Cairo: ['القاهرة'], Krakow: ['Kraków'], Gothenburg: ['Göteborg'], Antwerp: ['Antwerpen', 'Anvers'], Brussels: ['Bruxelles', 'Brussel'], Florence: ['Firenze'], Naples: ['Napoli'], Turin: ['Torino'], Milan: ['Milano'], Seville: ['Sevilla'], Porto: ['Oporto'], Frankfurt: ['Frankfurter'], Hamburg: ['Hamburger'], Belgrade: ['Beograd'], Bucharest: ['București', 'Bucuresti'], Beijing: ['\u5317\u4eac', 'Peking'], Odesa: ['Одеса', 'Одесса', 'Odessa'], Lviv: ['Львів', 'Lwów'], Zagreb: [], Helsinki: ['Helsingfors'], Edinburgh: ['Edina'], Istanbul: ['İstanbul', 'Stamboul'], Tbilisi: ['თბილისი'], Tehran: ['تهران'], Baghdad: ['بغداد'], Beirut: ['بيروت'], Amman: ['عمان'], Tunis: ['تونس'], Algiers: ['Alger', 'الجزائر'], Casablanca: ['الدار البيضاء'], Marrakech: ['مراكش'], Riyadh: ['الرياض'], Doha: ['الدوحة'], Dubai: ['دبي'], Mumbai: ['Bombay'], Kolkata: ['Calcutta'], Chennai: ['Madras'], Bangalore: ['Bengaluru'], Yangon: ['Rangoon'], Jakarta: ['Batavia'], 'Ho Chi Minh City': ['Saigon', 'Sài Gòn'], Hanoi: ['Hà Nội'], Minsk: ['Мінск', 'Минск'], Sofia: ['София', 'София'], Skopje: ['Скопје'], 'Saint Petersburg': ['Петербург', 'Peterburg', 'Leningrad', 'Ленинград'], Tallinn: [], Riga: ['Rīga'], Vilnius: [], Bratislava: [], Ljubljana: [], Valletta: [], Nicosia: ['Λευκωσία', 'Lefkosa'], Yerevan: ['Երևան'], Baku: ['Bakı'], Tashkent: ['Toshkent', 'Ташкент'], Almaty: ['Алматы'], Ulaanbaatar: ['Улаанбаатар'], Kathmandu: ['Kantipur'], 'Osaka': ['\u5927\u962a'], 'Shanghai': ['\u4e0a\u6d77'], 'Hong Kong': ['\u9999\u6e2f'], 'Taipei': ['\u53f0\u5317', '\u81fa\u5317'], 'Singapore': ['\u65b0\u52a0\u5761'], 'Kuala Lumpur': ['\u5409\u9686\u5761'], 'Kyoto': ['\u4eac\u90fd'], 'Nagoya': ['\u540d\u53e4\u5c4b'], 'Shenzhen': ['\u6df1\u5733'], 'Guangzhou': ['\u5e7f\u5dde', '\u5ee3\u5dde'], 'Chengdu': ['\u6210\u90fd'], 'Busan': ['\u91dc\u5c71'], 'Kaohsiung': ['\u9ad8\u96c4'] };

/** Country names in CJK scripts (Chinese street names can spell them). */
const COUNTRY_ENDONYMS = { JP: ['\u65e5\u672c'], CN: ['\u4e2d\u56fd', '\u4e2d\u570b'], KR: ['\u97e9\u56fd', '\u97d3\u570b'], TW: ['\u53f0\u6e7e', '\u81fa\u7063', '\u53f0\u7063'], HK: ['\u9999\u6e2f'], SG: ['\u65b0\u52a0\u5761'] };

/** true when a street name spells the city or country (would give the answer away). */
export function leaks(name, c, countryEn) {
  const f = fold(name);
  const words = [c.city, c.city.replace(/^Saint /, 'St '), countryEn].filter(Boolean).map(fold);
  const endo = [...(ENDONYMS[c.city] || []), ...(COUNTRY_ENDONYMS[c.cc] || [])];
  if (endo.some((z) => z.length >= 2 && name.includes(z))) return true;
  return words.some((w) => w.length >= 4 && f.includes(w.length > 6 ? w.slice(0, w.length - 2) : w));
}

const km = (a, b) => Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * Math.cos((a[0] * Math.PI) / 180));

export function chooseJunction(ways, c, countryEn) {
  for (const min of [5, 4, 3]) {
    const J = findJunctions(ways, min).map((j) => {
      const names = [...j.names.keys()];
      return { ...j, names, bad: names.some((n) => leaks(n, c, countryEn)), d: km([j.lat, j.lng], [c.lat, c.lng]) };
    }).filter((j) => !j.bad);
    if (!J.length) continue;
    // most names (cap 6) first, then closest to the centre
    J.sort((a, b) => Math.min(6, b.names.length) - Math.min(6, a.names.length) || a.d - b.d);
    return J[0];
  }
  return null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const en = new Intl.DisplayNames(['en'], { type: 'region' });
  const out = [];
  for (const [city, continent, cc, lat, lng] of cities) {
    const country = en.of(cc);
    if (SKIP_CITIES.has(city)) continue;
    const f = `raw/${city.replace(/\W/g, '_')}.r3.json.gz`;
    if (!fs.existsSync(f)) { console.log('missing', city); continue; }
    const { R, ways } = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
    const best = chooseJunction(ways, { city, country, cc, lat, lng }, country);
    if (!best) { console.log('none', city); continue; }
    const streets = best.names.slice(0, 6).map((n) => { const e = ways.find((w) => w.n === n && w.en)?.en; return e && e !== n ? { n, en: e } : { n }; });
    out.push({ city, country, continent, cc, lat, lng, junction: [+best.lat.toFixed(5), +best.lng.toFixed(5)], streets, radius: R });
    console.log(city, streets.length, streets.map((s) => s.n).join(' | '));
  }
  fs.writeFileSync('../data.json', JSON.stringify({ osmDate: new Date().toISOString().slice(0, 10), puzzles: out }));
  console.log('puzzles', out.length);
}
