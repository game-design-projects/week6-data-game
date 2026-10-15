// #72 Garage — the ten most-registered car brands of a New York county; guess the county.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

const cap = (s) => s.toLowerCase().replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());
const ALIAS = { KINGS: ['Brooklyn'], 'NEW YORK': ['Manhattan'], RICHMOND: ['Staten Island'] };
const brand = (data, k) => data.makes[k] || k;

/** Ratio line used in the "over-represented" clue. */
export function liftText(x) { return `${x[1].toFixed(1)}× the state average`; }

const ORIG = ['American', 'Japanese/Korean', 'European'];
/** "American 52% · Japanese/Korean 36% · European 7%" */
export function origText(o) { return o.map((v, i) => `${ORIG[i]} ${v}%`).join(' · '); }

/** Which brand-origin group deviates most from the state, as a sentence (used in the result card). */
export function patternText(c, data) {
  const diffs = c.orig.map((v, i) => v - data.stateOrig[i]);
  let k = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(diffs[i]) > Math.abs(diffs[k])) k = i;
  const d = diffs[k];
  const tone = k === 0 && d > 0 ? 'More American brands (pickups, SUVs), typical of rural upstate counties and small cities.'
    : k === 2 && d > 0 ? 'More European luxury brands, typical of New York City, Long Island or wealthy Hudson Valley suburbs.'
    : k === 1 && d > 0 ? 'More Japanese and Korean brands, typical of city neighborhoods, college towns or mountain areas (Subaru).'
    : k === 0 ? 'Fewer American brands than the state, which suggests a metro area or a place where Japanese brands dominate.'
    : k === 1 ? 'Fewer Japanese and Korean brands than the state, so local owners lean American or European.'
    : 'Fewer European brands than the state, so luxury marques are rare.';
  return `${ORIG[k]} brands make up ${c.orig[k]}%, ${Math.abs(d).toFixed(1)} points ${d > 0 ? 'above' : 'below'} the state (${data.stateOrig[k]}%). ${tone}`;
}

/** Score for winning on guess n of max (1-based); 0 when not won. */
export function scoreFor(n, won, max = 6) { return won ? Math.round(100 * (max - n + 1) / max) : 0; }

export default {
  meta: {
    num: 72,
    slug: 'garage',
    title: 'Garage',
    tagline: 'The ten most-registered car brands in one New York county. Read the garage, guess the county.',
    category: 'society',
    data: 'snapshot',
    howTo: [
      'You get the ten most-registered passenger-car brands of a New York county (as a percent of all its passenger cars).',
      'Pick one of the 62 New York counties, up to 6 guesses. Each miss unlocks a clue: favored brands, American/Japanese-Korean/European split, total registrations, coordinates, first letter.',
      'Every guess shows how far your county is from the answer and in which direction.',
      'Hint: pickups and GMC/Ram mean rural upstate; BMW, Mercedes, Porsche and Tesla cluster in New York City and Long Island; Subaru loves the mountains.',
    ],
    scoring: '100 points for a correct 1st guess, about 17 fewer for each extra guess, and 0 if you miss all 6.',
    sources: [
      { name: 'NY DMV Vehicle, Snowmobile, and Boat Registrations (data.ny.gov)', url: 'https://data.ny.gov/Transportation/Vehicle-Snowmobile-and-Boat-Registrations/w4pv-hbkt' },
      { name: 'US Census Gazetteer 2023 (county centroids)', url: 'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html' },
    ],
    dataNote: 'Counts only active registrations with record_type=VEH and registration_class=PAS (passenger cars), by the owner\'s county, as an October 2026 snapshot; out-of-state registrations are excluded. DMV makes are 5-character codes (such as CHEVR), mapped by hand to brand names with spelling variants merged (CHEV/CHEVY and so on). Shares use all of the county\'s passenger cars as the denominator; unmapped makes such as RVs and trailers are only about 0.3%. Origin groups follow each brand\'s headquarters (Tesla, Rivian and Lucid count as American). The official data updates continuously, but the game uses a fixed snapshot so each county\'s puzzle does not drift with the date.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.counties).id };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const byId = new Map(data.counties.map((c) => [c.id, c]));
    const ans = byId.get(p.id);
    ctx.log('answer county', ans.id);

    const bars = await ui.plot((Plot, c) => ({
      height: 300,
      marginLeft: 110, marginRight: 36, marginBottom: 44,
      x: { label: '% of the county\'s passenger cars', grid: true, labelAnchor: 'right' },
      y: { label: null, domain: ans.top.map((t) => brand(data, t[0])) },
      marks: [
        Plot.barX(ans.top, { x: (t) => t[1], y: (t) => brand(data, t[0]), fill: c.accent, sort: null }),
        Plot.text(ans.top, { x: (t) => t[1], y: (t) => brand(data, t[0]), text: (t) => `${t[1]}%`, dx: 4, textAnchor: 'start', fill: c.ink }),
        Plot.ruleX([0]),
      ],
    }), { width: Math.max(280, Math.min(560, (ctx.stage.clientWidth || 360) - 80)) });

    const side = ans.lng < -76.5 ? 'western' : ans.lng < -74.2 ? 'central' : 'eastern';
    const clues = [
      ui.h('div', bars),
      ui.h('div', 'Compared with the state average, this county especially favors:', ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.2em' } },
        ans.over.map((x) => ui.h('li', `${brand(data, x[0])} (${x[2]}%, ${liftText(x)})`)))),
      `By brand origin: ${origText(ans.orig)} (state: ${origText(data.stateOrig)}). Tesla is ${ans.tesla}% (state ${data.stateShare.TESLA}%). Least favored brands: ${ans.under.map((x) => brand(data, x[0])).join(', ')}.`,
      `The county has about ${ctx.core.fmtNum(Math.round(ans.total / 1000) * 1000)} registered passenger cars.`,
      `It lies in ${side} New York (${Math.abs(ans.lng).toFixed(1)}°W, ${ans.lat.toFixed(1)}°N).`,
      `The county name starts with \u201c${ans.id[0]}\u201d.`,
    ];

    const options = data.counties.map((c) => ({ id: c.id, label: c.name, aliases: [c.id, cap(c.id), ...(ALIAS[c.id] || [])] }));
    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: 6,
      scoring: (n, won) => scoreFor(n, won),
      title: 'Which New York county is this?',
      placeholder: 'Type a county name, e.g. Erie…',
      clues,
      cluesTitle: 'Garage clues',
      columns: ['Distance', 'Direction'],
      near: (g, a) => haversineKm(byId.get(g.id), byId.get(a.id)) < 80,
      feedback: (g) => {
        const gc = byId.get(g.id);
        if (gc.id === ans.id) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }];
        const km = haversineKm(gc, ans);
        return [{ text: fmtKm(km), num: true, state: km < 80 ? 'near' : undefined }, { text: arrow(bearingDeg(gc, ans)) }];
      },
    });
    ctx.log('result', res.score);

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `Answer: ${ans.name} County, about ${ctx.core.fmtNum(ans.total)} passenger cars.`),
      ui.h('div', patternText(ans, data)),
      ui.h('div', `The top brand is ${brand(data, ans.top[0][0])} (${ans.top[0][1]}%); Tesla is ${ans.tesla}% against ${data.stateShare.TESLA}% statewide. What gives the county away is how much it favors certain brands over the state:`),
      ui.table({
        columns: [{ key: 'b', label: 'Brand' }, { key: 's', label: 'County share', num: true }, { key: 'st', label: 'State share', num: true }, { key: 'r', label: 'Ratio', num: true }],
        rows: ans.over.map((x) => ({ b: brand(data, x[0]), s: `${x[2]}%`, st: `${data.stateShare[x[0]]}%`, r: `${x[1].toFixed(1)}×` })),
      }));
    return res;
  },
};
