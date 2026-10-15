// #13 Intersection — several street names meeting at one OSM junction; guess the city.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

/** Writing systems (and tell-tale diacritics) present in a list of street names. */
export function scriptsOf(names) {
  const text = names.join('');
  const tests = [
    ['Han characters', /[\u4e00-\u9fff]/], ['Japanese kana', /[぀-ヿ]/], ['Hangul', /[가-힯]/], ['Cyrillic', /[Ѐ-ӿ]/],
    ['Arabic', /[؀-ۿ]/], ['Greek', /[Ͱ-Ͽ]/], ['Hebrew', /[֐-׿]/], ['Thai', /[฀-๿]/],
    ['Devanagari', /[ऀ-ॿ]/], ['Bengali', /[ঀ-৿]/], ['Georgian', /[Ⴀ-ჿ]/], ['Armenian', /[԰-֏]/],
    ['Sinhala', /[඀-෿]/], ['Burmese', /[က-႟]/], ['Khmer', /[ក-៿]/], ['Mongolian', /[᠀-᢯]/],
  ];
  const found = tests.filter(([, re]) => re.test(text)).map(([n]) => n);
  if (/[A-Za-z]/.test(text)) {
    const marks = [...new Set(text.normalize('NFC').match(/[^\u0000-\u007f]/g) || [])].filter((c) => /\p{L}/u.test(c) && /[À-ɏ]/.test(c));
    found.unshift(marks.length ? `Latin (with ${marks.slice(0, 6).join(' ')})` : 'Latin (no diacritics)');
  }
  return found;
}

/** The most common word shared by 2+ street names (e.g. "Rue", "Street"). */
export function commonWord(names) {
  const cnt = new Map();
  for (const n of names) for (const w of new Set(n.split(/[\s,.\-–]+/).filter((x) => x.length >= 2))) cnt.set(w, (cnt.get(w) || 0) + 1);
  const best = [...cnt.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
  return best ? { word: best[0], count: best[1] } : null;
}

/** Naming conventions that point to a language family / region. [regex, explanation] */
export const PATTERNS = [
  [/\b(Rue|Quai|Impasse|Chemin|Allée)\b/i, '“Rue / Quai / Impasse” are French street names'],
  [/(straße|strasse|str\.|\bgasse\b|platz\b|\bweg\b|\bufer\b|damm\b)/i, '“-straße / -gasse / -platz” are German street names'],
  [/\b(Calle|Avenida|Paseo|Plaza|Carrer|Plaça|Ronda|Travesía|Jirón|Carrera|Transversal|Calzada)\b/i, '“Calle / Carrer / Avenida” are Spanish (or Catalan) street names'],
  [/\b(Rua|Praça|Travessa|Largo|Calçada)\b|\bAvenida\b.*[ãçõ]/i, '“Rua / Praça / Calçada” are Portuguese street names'],
  [/\b(Via|Viale|Piazza|Corso|Vicolo)\b/i, '“Via / Corso / Piazza” are Italian street names'],
  [/\b(Strada|Bulevardul|Calea|Șoseaua)\b/i, '“Strada / Bulevardul” are Romanian street names'],
  [/(gatan|gata\b|gate\b|gade\b|vägen|vej\b|veien|torg\b)/i, '“-gatan / -gata / -gade” are Nordic street names'],
  [/(katu\b|tie\b|kuja\b)/i, '“-katu / -tie” are Finnish street names'],
  [/(straat|laan\b|plein\b|gracht\b|kade\b)/i, '“-straat / -plein / -gracht” are Dutch street names'],
  [/\b(utca|tér|körút|lépcső)\b/i, '“utca / tér” are Hungarian street names'],
  [/(ulica|ul\.|aleja|plac\b|aleje)/i, '“ulica / aleja / plac” are Polish street names'],
  [/\b(ulice|náměstí|nábřeží|třída)\b|^U\s/i, '“ulice / náměstí” are Czech street names'],
  [/\b(улица|площадь|проспект|переулок|бульвар|вулиця|площа)\b/i, '“улица / площадь / вулиця” are Russian or Ukrainian street names'],
  [/(sokağı|sokak|caddesi|cad\.)/i, '“Sokağı / Caddesi” are Turkish street names'],
  [/\b(Jalan|Lorong|Lebuh)\b/i, '“Jalan” is the Malay / Indonesian word for road'],
  [/\b(Phố|Đường|Ngõ)\b/i, '“Phố / Đường” are Vietnamese for street / road'],
  [/^ถนน|ซอย/, '“ถนน / ซอย” are Thai for road / lane'],
  [/(\u901aり|\u9053\u8def|\u56fd\u9053|\u99c5\u524d)/, '“\u901aり / \u56fd\u9053” are Japanese street names'],
  [/[가-힣]+(로|길)\b/, '“-로 / -길” come from the Korean road-naming system'],
  [/(\u80e1\u540c|\u5927\u8857|\u8def|\u8857|\u5df7)/, '“\u8def / \u8857 / \u5df7 / \u80e1\u540c” are Chinese street names'],
  [/(شارع|طريق)/, '“شارع” is Arabic for street'],
  [/(ქუჩა|გამზირი)/, '“ქუჩა” is Georgian for street'],
  [/(רחוב|שדרות)/, '“שדרות / רחוב” are Hebrew for boulevard / street'],
  [/\b\d+(st|nd|rd|th)\b.*\b(Street|Avenue)\b|\b(North|South|East|West)\w*\b.*\b(Street|Avenue)\b/i, 'Numbered streets plus compass words (North / West…) are the habit of North American grid cities'],
  [/\b(Street|Road|Lane|Crescent|Terrace|Close|Parade|Place|Way)\b/i, '“Street / Road / Crescent / Close” are English street names (common in the UK, Ireland, Australia, New Zealand, South Africa, East Africa and other Commonwealth countries)'],
];

/** Which naming conventions show up in these names (specific to this puzzle). */
export function patternsIn(names) {
  const out = [];
  for (const [re, text] of PATTERNS) {
    const hit = names.filter((n) => re.test(n));
    if (hit.length) out.push({ text, hit });
  }
  return out.slice(0, 3);
}

/** 100 → 17 over six guesses, 0 when not found. */
export const scoreFor = (n, won, max = 6) => (won ? Math.round((100 * (max - n + 1)) / max) : 0);

export default {
  meta: {
    num: 13,
    slug: 'intersection',
    title: 'Intersection',
    tagline: 'Several streets meet at one junction. From the street names alone, name the city.',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      'You get the names of streets that meet at one real OpenStreetMap junction (3 to 6 of them; junctions with 5 or more are preferred).',
      'Pick a city from the list. You have 6 guesses, and every miss unlocks another clue: writing system, continent, country, first letter…',
      'Each guess tells you how far that city is from the answer, and in which direction. Use it to narrow things down.',
      'Tips: Rue, Straße, Calle, \u901aり, \u8def… naming habits, diacritics and the names of people honored on street signs are all clues.',
      'Scoring: 100 points for a first-try hit, about 17 fewer for each extra guess, and 0 if you miss all six.',
    ],
    scoring: '100 points for a first-try hit, about 17 fewer for each extra guess, 0 if you miss all six.',
    sources: [
      { name: 'OpenStreetMap (Overpass API)', url: 'https://overpass-api.de/', note: '© OpenStreetMap contributors, ODbL. Named roads within 3 km of each city center.' },
    ],
    dataNote: 'A snapshot of OpenStreetMap, not live data: each day\'s puzzle is set by the date, whether or not the map has changed. City centers are hand-picked approximations. The junction is the node within 3 km of the center where the most differently named streets meet (5 or more where possible; a few cities only have 3 or 4). Junctions whose street names spell out the city or country are excluded, so it is not necessarily the best-known intersection. Footpaths, trails and parking aisles are left out. Street names are the local OSM originals, untranslated.',
  },

  puzzle({ data, pick }) {
    const c = pick(data.puzzles);
    return { city: c.city };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const all = ctx.data.puzzles;
    const byId = new Map(all.map((c) => [c.city, c]));
    const ans = byId.get(p.city);
    const names = ans.streets.map((s) => s.n);
    ctx.log('intersection', ans.city, names);
    const scripts = scriptsOf(names);
    const cw = commonWord(names);

    const streetList = ui.h('div', { class: 'ds-stack', style: { gap: '8px' } },
      ans.streets.map((s, i) => ui.h('div', { class: 'ds-row', style: { gap: '10px', alignItems: 'baseline' } },
        ui.h('span', { class: 'mono muted small' }, String(i + 1)),
        ui.h('span', { style: { fontSize: '1.1rem', fontWeight: 600, overflowWrap: 'anywhere' } }, s.n))));
    ctx.stage.append(ui.panel({ kicker: 'One junction · from OpenStreetMap', title: `${ans.streets.length} streets meet here` }, streetList));

    const clues = [
      `${ans.streets.length} streets in all, with names exactly as they appear on the local map.`,
      `Writing system: ${scripts.join(', ') || 'unknown'}.${cw ? ` ${cw.count} of the names contain “${cw.word}”.` : ''}`,
      `The city is in ${ans.continent}.`,
      `The city is in ${ans.country}.`,
      `The city name starts with “${ans.city[0]}” and has ${ans.city.length} letters.`,
    ];
    const options = all.map((c) => ({ id: c.city, label: c.city, hint: c.country, aliases: [c.country, c.cc, ...(c.city.startsWith('Saint ') ? ['St ' + c.city.slice(6)] : [])] }));
    const res = await ctx.guess({
      options, answer: ans.city, maxGuesses: 6, title: 'Which city is this?', placeholder: 'Type a city, e.g. Lima…',
      clues, cluesTitle: 'Clues', columns: ['Distance', 'Direction'],
      scoring: (n, won) => scoreFor(n, won),
      near: (g, a) => haversineKm(byId.get(g.id), byId.get(a.id)) < 1000,
      feedback: (g) => {
        const gc = byId.get(g.id);
        if (gc.city === ans.city) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }];
        const km = haversineKm(gc, ans);
        return [{ text: fmtKm(km), num: true, state: km < 1000 ? 'near' : undefined }, { text: arrow(bearingDeg(gc, ans)) }];
      },
    });
    ctx.log('result', res.score);

    const pats = patternsIn(names);
    const why = ui.h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, [
      ui.h('li', null, `Writing system: ${scripts.join(', ')}${cw ? `; ${cw.count} names share “${cw.word}”` : ''}.`),
      ...pats.map((x) => ui.h('li', null, `${x.text}: ${x.hit.slice(0, 3).join(', ')}`)),
      ui.h('li', null, `This junction is about ${fmtKm(haversineKm({ lat: ans.junction[0], lng: ans.junction[1] }, ans))} from the center of ${ans.city}, where ${ans.streets.length} streets meet.`),
    ]);
    let mapEl = null;
    try {
      const m = await ui.createMap({ center: ans.junction, zoom: 16, labels: true, height: 240 });
      m.pin(ans.junction, 'answer', ans.city);
      mapEl = m.el;
    } catch (e) { ctx.log.warn('map failed', String(e)); }
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['Answer', `${ans.city}, ${ans.country}`],
        ['Junction', `${ans.junction[0]}, ${ans.junction[1]}`],
        ['Map', ui.h('a', { href: `https://www.openstreetmap.org/?mlat=${ans.junction[0]}&mlon=${ans.junction[1]}#map=18/${ans.junction[0]}/${ans.junction[1]}`, target: '_blank', rel: 'noopener' }, 'View on OpenStreetMap')],
        ['What gave it away', why],
      ]),
      mapEl,
      ui.table({ columns: [{ key: 'n', label: 'Street name (original)' }, { key: 'en', label: 'English name (OSM name:en)' }], rows: ans.streets.map((s) => ({ n: s.n, en: s.en || '—' })) }));
    return res;
  },
};
