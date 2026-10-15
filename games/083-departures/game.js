// #83 Departures — the full list of destinations from one airport; guess the airport.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

export const MAX_GUESSES = 6;
const REDACT = '▇▇▇';

/** Count of destinations two airports share. */
export function sharedCount(a, b) {
  const s = new Set(a);
  return b.filter((x) => s.has(x)).length;
}

/** 100 for a first-try hit, then -1/6 per extra guess, 0 if never found. */
export function scoreFor(n, won) {
  return won ? Math.round((100 * (MAX_GUESSES - n + 1)) / MAX_GUESSES) : 0;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Mask every occurrence of the answer's city name. */
export function maskCity(text, city) {
  return city ? text.replace(new RegExp(`(?<![\\p{L}])${esc(city)}(?![\\p{L}])`, 'giu'), REDACT) : text;
}

export const destCodes = (data, code) => (data.routes[code] ? data.routes[code].split(' ') : []);

/** Everything the clues and the explanation need, computed from the snapshot. Pure. */
export function analyze(data, code) {
  const by = new Map(data.airports.map((a) => [a.c, a]));
  const ans = by.get(code);
  const pz = data.puzzles.find((x) => x.a === code);
  const codes = destCodes(data, code);
  const dests = codes.map((c) => by.get(c));
  const tally = {};
  for (const d of dests) tally[d.co] = (tally[d.co] ?? 0) + 1;
  const countries = Object.entries(tally).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const domestic = tally[ans.co] ?? 0;
  const byDist = dests.map((d) => ({ ...d, km: haversineKm(ans, d) })).sort((a, b) => a.km - b.km || (a.c < b.c ? -1 : 1));
  const airlines = pz.al.map(([n, k]) => [maskCity(n, ans.city), k]);
  return { by, ans, pz, codes, dests, tally, countries, domestic, byDist, airlines };
}

/** Plain-text view of clues 1–5 (before the country is given away) — used by the leak test. */
export function preCountryText(data, code) {
  const a = analyze(data, code);
  return [
    a.countries.slice(0, 8).map(([c, n]) => `${c} \u00d7${n}`).join(' '),
    a.codes.join(' '),
    [...new Set(a.dests.map((d) => d.city))].join(' '),
    a.airlines.map(([n, k]) => `${n} ${k}`).join(' '),
    `${a.byDist[0].city} ${a.byDist.at(-1).city}`,
  ].join('\n');
}

export function explain(a, code) {
  const n = a.dests.length;
  const pct = Math.round((a.domestic / n) * 100);
  const [topAl, topK] = a.pz.al[0];
  const alPct = Math.round((topK / n) * 100);
  const far = a.byDist.at(-1);
  const bits = [];
  if (pct >= 60) bits.push(`Domestic destinations make up ${pct}% (${a.domestic}/${n}): mostly home-country routes, typical of a domestic hub in a big country.`);
  else if (pct <= 10) bits.push(`Only ${pct}% of destinations are domestic (${a.domestic}/${n}): almost all international, typical of a small country or a transfer hub.`);
  else bits.push(`Domestic destinations make up ${pct}% (${a.domestic}/${n}): a mix of domestic and international routes.`);
  const [c1, k1] = a.countries[0];
  bits.push(` The top destination country is ${c1} (${k1} airports, ${Math.round((k1 / n) * 100)}%).`);
  bits.push(alPct >= 50
    ? ` ${topAl} alone flies to ${topK} of them (${alPct}%), so this is its home base.`
    : ` The biggest airline, ${topAl}, has only ${alPct}%: several carriers share the airport, an open hub.`);
  bits.push(` The farthest destination is ${far.city} (${fmtKm(far.km)}), the nearest ${a.byDist[0].city} (${fmtKm(a.byDist[0].km)}).`);
  return bits.join('');
}

export default {
  meta: {
    num: 83,
    slug: 'departures',
    title: 'Departures',
    tagline: 'Every nonstop destination from one airport. Work out which airport it is from the pattern.',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      'You get the full list of nonstop destinations from one airport. Its name and city are hidden.',
      'Pick an airport from the list to guess, up to 6 times. Each miss unlocks another clue: destination codes, destination cities, airlines, nearest and farthest destinations, and finally the country.',
      'Every guess shows how far your airport is from the answer, in which direction, and how many destinations the two share.',
      'Scoring: 100 for a first-try hit, about 17 less for each extra guess, 0 if you never find it.',
      'Tip: a high share of domestic destinations means a domestic hub in a big country; destinations in many countries usually mean an international transfer hub.',
    ],
    scoring: '100 for a first-try hit, about 17 less for each extra guess, 0 if you never find it.',
    sources: [
      { name: 'OpenFlights routes, airports & airlines database', url: 'https://openflights.org/data.html', note: 'route data stopped updating around 2014; airline counts use nonstop, non-codeshare flights only' },
      { name: 'OpenFlights data on GitHub', url: 'https://github.com/jpatokal/openflights/tree/master/data' },
    ],
    dataNote: 'OpenFlights stopped updating its routes around 2014: some routes no longer fly and new ones are missing, so treat this as a historical timetable, not today\u2019s flights. Only nonstop routes departing from each airport are counted, and countries follow OpenFlights\u2019 borders of that time. We found no keyless, browser-callable source of newer routes (OpenSky needs an account, airline schedule APIs need keys), so there is no live data.',
  },

  puzzle({ data, pick }) {
    return { code: pick(data.puzzles).a };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const a = analyze(ctx.data, p.code);
    const { ans, by, dests, countries, domestic, byDist } = a;
    const n = dests.length;
    ctx.log('answer', p.code, 'destinations', n);

    const clues = [
      ui.h('div', { class: 'ds-stack' },
        ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
          ui.stat({ label: 'Nonstop destinations', value: String(n) }),
          ui.stat({ label: 'Countries', value: String(countries.length) }),
          ui.stat({ label: 'Domestic share', value: `${Math.round((domestic / n) * 100)}%` })),
        ui.chips(countries.slice(0, 8).map(([c, k]) => `${c} \u00d7${k}`))),
      ui.h('div', 'IATA codes of all destinations:', ui.h('div', { class: 'mono small', style: { marginTop: '6px', lineHeight: 1.7 } }, a.codes.join(' '))),
      ui.h('div', 'Destination cities:', ui.h('div', { class: 'small ink2', style: { marginTop: '6px' } }, [...new Set(dests.map((d) => d.city))].sort().join(' · '))),
      ui.h('div', 'Airlines flying the most of these routes:', ui.h('div', { class: 'small ink2', style: { marginTop: '6px' } }, a.airlines.map(([nm, k]) => `${nm} (${k} ${k === 1 ? 'destination' : 'destinations'})`).join(', '))),
      `Nearest destination: ${byDist[0].city} (${fmtKm(byDist[0].km)}). Farthest: ${byDist.at(-1).city} (${fmtKm(byDist.at(-1).km)}).`,
      `The airport is in ${ans.co}; the city name starts with \u201c${ans.city[0]}\u201d.`,
    ];

    const options = ctx.data.optionCodes.map((c) => {
      const o = by.get(c);
      return { id: c, label: `${o.city} · ${c}`, hint: `${o.n}, ${o.co}`, aliases: [o.n, o.co, c] };
    });
    const res = await ctx.guess({
      options, answer: p.code, maxGuesses: MAX_GUESSES, scoring: scoreFor,
      title: 'Which airport is this?', placeholder: 'Type a city or IATA code, e.g. LHR or Chicago\u2026',
      clues, cluesTitle: 'Departures board and clues',
      columns: ['Distance', 'Dir.', 'Shared'],
      near: (g) => haversineKm(by.get(g.id), ans) < 800,
      feedback: (g) => {
        if (g.id === p.code) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: `${n}/${n}`, state: 'hit', num: true }];
        const ga = by.get(g.id);
        const km = haversineKm(ga, ans);
        const sh = sharedCount(destCodes(ctx.data, g.id), a.codes);
        return [
          { text: fmtKm(km), num: true, state: km < 800 ? 'near' : undefined },
          { text: arrow(bearingDeg(ga, ans)) },
          { text: `${sh}/${n}`, num: true, state: sh / n >= 0.25 ? 'near' : undefined },
        ];
      },
    });
    ctx.log('result', res.score);

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['Airport', `${ans.n} (${p.code})`], ['City', `${ans.city}, ${ans.co}`], ['Nonstop destinations', `${n}, of which ${domestic} domestic`], ['Main airlines', a.pz.al.slice(0, 3).map((x) => x[0]).join(', ')]]),
      ui.h('div', { class: 'small ink2' }, 'Reading the clues: ' + explain(a, p.code)));
    return res;
  },
};
