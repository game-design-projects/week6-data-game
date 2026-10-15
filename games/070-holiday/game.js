// #70 Holiday — a year of public holidays with the names hidden; guess the country.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

const enName = (cc) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc); } catch { return cc; } };
const WEEKEND = (y, md) => [0, 6].includes(new Date(`${y}-${md}T00:00:00Z`).getUTCDay());
const strip = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const BAR = '▇▇▇';

/**
 * Black out every word that starts with one of the country's `terms` (stems of the country's and capital's
 * name in dozens of languages, precomputed in build/build.mjs; accent-insensitive). CJK terms are plain
 * substrings. Whole words are replaced, so no "▇▇▇lantis"-style fragments survive.
 */
export function redact(text, terms) {
  const alpha = terms.filter((t) => !CJK.test(t));
  const han = terms.filter((t) => CJK.test(t));
  let out = String(text).replace(/[\p{L}\p{M}]+/gu, (w) => {
    if (CJK.test(w)) return w;
    const k = strip(w);
    return alpha.some((t) => k.startsWith(t)) ? BAR : w;
  });
  for (const t of han) out = out.split(t).join(BAR);
  return out.replace(new RegExp(`${BAR}(?:[\\s\\-'’]+${BAR})+`, 'g'), BAR);
}

/** Round score: 1st guess 100, then −1/6 per extra guess, 0 if never found. */
export function scoreFor(n, won, max = 6) {
  return won ? Math.round((100 * (max - n + 1)) / max) : 0;
}

const FAITH = [
  ['Christian', /christmas|easter|good friday|epiphany|ascension|pentecost|assumption|all saints|immaculate|corpus christi|whit monday|holy thursday|maundy|annunciation|nativity|candlemas/i],
  ['Islamic', /eid|ramadan|mawlid|prophet|muharram|ashura|hijri|isra|laylat|arafat|tabaski|korit/i],
  ['Buddhist', /vesak|buddha|visakha|magha|asalha|songkran|poya/i],
  ['Hindu', /diwali|deepavali|holi\b|dussehra|navratri|ganesh|krishna|thaipusam|maha shivaratri/i],
];
/** Count holidays per religion from their English names. */
export function faithCounts(holidays) {
  return FAITH.map(([label, re]) => ({ label, n: holidays.filter((h) => re.test(h.name)).length })).filter((x) => x.n > 0);
}

/** Holidays sorted from most unusual (fewest countries share the English name) to most generic. */
export function rarest(holidays, k) {
  return holidays.slice().sort((a, b) => a.common - b.common || (a.d < b.d ? -1 : 1))
    .filter((x, i, arr) => arr.findIndex((y) => y.name === x.name) === i).slice(0, k);
}

export default {
  meta: {
    num: 70,
    slug: 'holiday',
    title: 'Holiday',
    tagline: 'A full year of public holidays with every name hidden. Read the dates and guess the country.',
    category: 'society',
    data: 'snapshot',
    howTo: [
      'The calendar marks every public holiday a country has in 2026: the accent color is a national holiday, yellow is observed only in some regions, and gray blocks are weekends.',
      'Pick a country from the list. You get up to 6 guesses, and each miss unlocks another clue: religious flavor, holiday names, the local-language name, the capital\'s first letter. Country and capital names are blacked out.',
      'Each guess shows how far its capital is from the answer, in which direction, and what share of its holidays fall on the same days as the answer\'s.',
      'Tip: a long weekend around Easter means a Christian country; holidays whose dates drift from year to year usually follow a lunar or Islamic calendar.',
    ],
    scoring: 'A correct first guess scores 100, and each extra guess costs about 17 points (83, 67, 50, 33, 17). Six misses score 0.',
    sources: [
      { name: 'Nager.Date Public Holiday API (2026, "Public" holidays only)', url: 'https://date.nager.at/Api' },
      { name: 'GeoNames (capital coordinates and names)', url: 'https://download.geonames.org/export/dump/' },
    ],
    dataNote: 'Snapshot data: Nager.Date allows browser requests, but a year of holidays never changes, so it was fetched once at build time and saved as data.json. Only statutory (public) holidays are included, not bank holidays, school holidays or observances. The daily answer is drawn only from 155 sovereign countries and regions; overseas territories (such as Aruba or Guam) are selectable as guesses only. Holidays for China, Hong Kong and Japan show their local names in the original script.',
  },

  puzzle({ data, pick }) {
    const country = pick(data.countries.filter((c) => c.play));
    return { year: data.year, cc: country.cc };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const byCC = new Map(ctx.data.countries.map((c) => [c.cc, c]));
    const ans = byCC.get(p.cc);
    const H = ans.holidays;
    const hide = (t) => redact(t, ans.terms);
    const narrow = (globalThis.innerWidth ?? 1000) < 560;

    // clue 1 — the calendar
    const cells = [];
    for (let m = 1; m <= 12; m++) {
      const days = new Date(Date.UTC(p.year, m, 0)).getUTCDate();
      for (let d = 1; d <= days; d++) {
        const md = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hol = H.find((x) => x.d === md);
        cells.push({ m, d, md, kind: hol ? (hol.global ? 'National' : 'Regional') : WEEKEND(p.year, md) ? 'Weekend' : 'Workday' });
      }
    }
    const WEEKEND_FILL = 'color-mix(in srgb, var(--muted) 40%, transparent)';
    const calendar = await ui.plot((Plot, c) => ({
      height: narrow ? 220 : 300,
      marginLeft: 36,
      padding: 0.12,
      x: { label: null, ticks: [1, 5, 10, 15, 20, 25, 31], tickSize: 0 },
      y: { label: null, tickFormat: (m) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1], tickSize: 0 },
      color: { domain: ['National', 'Regional', 'Weekend', 'Workday'], range: [c.accent, c.near, WEEKEND_FILL, c.paper2] },
      marks: [
        Plot.cell(cells, { x: 'd', y: 'm', fill: 'kind', rx: 2, title: (x) => `${x.md} · ${x.kind}` }),
      ],
    }));

    const regional = H.filter((x) => !x.global).length;
    const onWeekend = H.filter((x) => WEEKEND(p.year, x.d)).length;
    const faith = faithCounts(H);
    const rare = rarest(H, 3);
    const localOnly = rarest(H.filter((x) => strip(x.local) !== strip(x.name)), 1)[0]; // a local name worth showing
    const mid = rarest(H.filter((x) => x.common >= 3 && x.common <= 40), 3);
    const list = (xs, key = 'name') => ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.2em' } },
      xs.map((x) => ui.h('li', ui.h('span', { class: 'mono small muted' }, `${x.d}  `), hide(x[key]))));
    const swatch = (color, label) => ui.h('span', ui.h('span', { style: { color } }, '■'), ` ${label}`);

    const clues = [
      ui.h('div', calendar, ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '6px', flexWrap: 'wrap' } },
        swatch('var(--accent)', 'National holiday'), swatch('var(--near)', 'Regional holiday'), swatch(WEEKEND_FILL, 'Weekend'))),
      `${H.length} ${H.length === 1 ? 'holiday' : 'holidays'} this year: ${regional} observed only in some regions, ${onWeekend} falling on a weekend.`,
      faith.length
        ? `Religious flavor: ${faith.map((f) => `${f.n} ${f.label}`).join(', ')}.`
        : 'Religious flavor: no obvious Christian, Islamic, Buddhist or Hindu holidays on the list.',
      mid.length ? ui.h('div', 'Some common holidays (other countries have them too; country and capital names blacked out):', list(mid)) : 'This country has no “moderately common” holidays, so the other clues will help more.',
      ui.h('div', 'The three most distinctive holidays (English names, country and capital names blacked out):', list(rare),
        localOnly && ui.h('div', { style: { marginTop: '8px' } }, `The local-language name for ${localOnly.d}:`, list([localOnly], 'local'))),
      `The capital's name starts with “${ans.capital.name[0]}”.`,
    ];

    const options = ctx.data.countries.map((c) => ({ id: c.cc, label: c.name, hint: c.cc, aliases: [...new Set([enName(c.cc), c.cc])] }));
    const res = await ctx.guess({
      options,
      answer: ans.cc,
      maxGuesses: 6,
      title: 'Which country is this?',
      placeholder: 'Type a country, e.g. Peru or Japan…',
      clues,
      cluesTitle: 'Calendar and clues',
      columns: ['Distance', 'Direction', 'Same days'],
      scoring: scoreFor,
      near: (g, a) => haversineKm(byCC.get(g.id).capital, byCC.get(a.id).capital) < 1000,
      feedback: (g) => {
        const gc = byCC.get(g.id);
        if (gc.cc === ans.cc) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: `${H.length}/${H.length}`, state: 'hit', num: true }];
        const km = haversineKm(gc.capital, ans.capital);
        const shared = sharedDays(gc, ans);
        return [
          { text: fmtKm(km), num: true, state: km < 1000 ? 'near' : undefined },
          { text: arrow(bearingDeg(gc.capital, ans.capital)) },
          { text: `${shared}/${H.length}`, num: true, state: shared >= H.length * 0.6 ? 'near' : undefined },
        ];
      },
    });

    // the "why" — specific to this country
    const twins = ctx.data.countries.filter((c) => c.cc !== ans.cc)
      .map((c) => ({ c, n: sharedDays(c, ans) })).sort((a, b) => b.n - a.n).slice(0, 3);
    const why = [];
    const top = rare[0];
    why.push(`The most telling holiday is “${top.name}” on ${top.d}${strip(top.local) !== strip(top.name) ? ` (locally “${top.local}”)` : ''}; only ${top.common} ${top.common === 1 ? 'country has' : 'countries have'} a holiday by that name in 2026.`);
    if (faith.length) why.push(`Religious flavor: ${faith.map((f) => `${f.n} ${f.label}`).join(', ')}. These holidays follow religious calendars, which makes them a good clue to the cultural sphere.`);
    else why.push('No obvious religious holidays on the list, so the calendar is mostly secular days like National Day and Labour Day.');
    why.push(`Closest calendars: ${twins.map((t) => `${t.c.name} (${t.n} days in common)`).join(', ')}. Countries that share a culture, colonial history or religion often share holidays.`);
    if (regional) why.push(`${regional} of the holidays are observed only in some regions, which suggests a federal or locally autonomous country.`);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `Answer: ${ans.name}, capital ${ans.capital.name}. ${H.length} public holidays in ${p.year}.`),
      ui.h('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, why.map((t) => ui.h('li', t))),
      ui.table({
        columns: [{ key: 'd', label: 'Date' }, { key: 'name', label: 'Name' }, { key: 'local', label: 'Local name' }],
        rows: H,
      }));
    return res;
  },
};

function sharedDays(a, b) {
  const set = new Set(b.holidays.map((x) => x.d));
  return a.holidays.filter((x) => set.has(x.d)).length;
}
