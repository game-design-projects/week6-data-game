// #96 Missing Number — a data "news brief" with three numbers blanked out; fill them in.
// Two kinds of brief: World Bank country profile (snapshot) and the USGS global earthquake tally of a recent UTC day (live).
import { dayStats, QUAKE_RANGE } from './quake.js';

const country = (cc) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc); } catch { return cc; } };

export const fmtPop = (n) => (n >= 1e9 ? `${+(n / 1e9).toFixed(2)} billion` : `${+(n / 1e6).toFixed(n >= 1e8 ? 0 : n >= 1e7 ? 1 : 2)} million`);
export const fmtSigned = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
const fmtTimes = (v) => `${Math.round(v)}`;
const fmtPct = (v) => `${v.toFixed(1)}%`;

const [Q25, Q45, Q5, QMAG, QDEP] = ['q25', 'q45', 'q5', 'qmag', 'qdep'].map((k) => QUAKE_RANGE[k]);
// how each fact is asked: estimate config + display text
export const FACTS = {
  pop:    { label: 'Total population', min: 3e6, max: 1.5e9, log: true, scoring: 'log', scale: 0.3, unit: 'people', fmt: fmtPop },
  gdp:    { label: 'GDP per capita', min: 200, max: 150000, log: true, scoring: 'log', scale: 0.3, unit: 'USD', fmt: (v) => `$${Math.round(v).toLocaleString('en-US')}` },
  growth: { label: 'Population change, 2012–2022', min: -20, max: 80, scoring: 'abs', scale: 8, step: 0.1, unit: '%', fmt: fmtSigned },
  life:   { label: 'Life expectancy', min: 45, max: 90, scoring: 'abs', scale: 4, step: 0.1, unit: 'years', fmt: (v) => `${v.toFixed(1)} years` },
  urban:  { label: 'Urban population share', min: 0, max: 100, scoring: 'abs', scale: 15, step: 0.1, unit: '%', fmt: fmtPct },
  net:    { label: 'Internet use', min: 0, max: 100, scoring: 'abs', scale: 15, step: 0.1, unit: '%', fmt: fmtPct },
  unemp:  { label: 'Unemployment rate', min: 0, max: 35, scoring: 'abs', scale: 4, step: 0.1, unit: '%', fmt: fmtPct },
  q25:    { label: 'Quakes of M2.5+', min: Q25[0], max: Q25[1], scoring: 'abs', scale: 25, step: 1, unit: 'quakes', fmt: fmtTimes },
  q45:    { label: 'Quakes of M4.5+', min: Q45[0], max: Q45[1], scoring: 'abs', scale: 8, step: 1, unit: 'quakes', fmt: fmtTimes },
  q5:     { label: 'Quakes of M5+', min: Q5[0], max: Q5[1], scoring: 'abs', scale: 3, step: 1, unit: 'quakes', fmt: fmtTimes },
  qmag:   { label: 'Strongest quake of the day', min: QMAG[0], max: QMAG[1], scoring: 'abs', scale: 0.5, step: 0.1, unit: 'magnitude', fmt: (v) => `M${v.toFixed(1)}` },
  qdep:   { label: 'Deepest quake of the day', min: QDEP[0], max: QDEP[1], scoring: 'abs', scale: 100, step: 1, unit: 'km', fmt: (v) => `${Math.round(v)} km` },
};
export const CKEYS = ['pop', 'growth', 'gdp', 'life', 'urban', 'net', 'unemp'];
export const QKEYS = ['q25', 'q45', 'q5', 'qmag', 'qdep'];
const LETTERS = ['A', 'B', 'C'];
export const LAG_DAYS = 3; // USGS catalogue is still being reviewed for the last ~2 days; 3 days back is stable for every player

/** Sentence fragments of the brief; `k` marks a number slot. */
export function storyParts(c) {
  return [
    `According to World Bank data, ${country(c.cc)} had a total population of `, { k: 'pop' }, ` in ${c.year}, a change of `, { k: 'growth' },
    ' since 2012. GDP per capita was ', { k: 'gdp' }, '; life expectancy ', { k: 'life' }, '; urban share of population ', { k: 'urban' },
    '; internet use ', { k: 'net' }, '; and unemployment ', { k: 'unemp' }, '.',
  ];
}
export function quakeParts(s) {
  return [
    `According to the US Geological Survey (USGS), the world recorded `, { k: 'q25' }, ` earthquakes of M2.5 or above on ${s.d} (UTC), including `, { k: 'q45' },
    ' of M4.5+ and ', { k: 'q5' }, ' of M5+. The strongest was ', { k: 'qmag' }, `, centered at ${s.magPlace}; the deepest reached `, { k: 'qdep' }, `, at ${s.depPlace}.`,
  ];
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// which known fact predicts which blank (first one that is not itself blanked wins)
const PREDICT = {
  life: ['gdp', 'net', 'urban'], urban: ['gdp', 'net', 'life'], net: ['gdp', 'life', 'urban'], unemp: ['gdp', 'life', 'net'],
  growth: ['gdp', 'life', 'urban'], gdp: ['net', 'life', 'urban'],
};
const logKeys = new Set(['pop', 'gdp']);

/** The country-brief explanation for one blank: how the nearest neighbours on a known fact answer it. */
export function countryTip(k, c, countries, blanks) {
  const f = FACTS[k];
  if (k === 'pop') {
    const rank = countries.filter((x) => x.pop > c.pop).length + 1;
    return `Population cannot be inferred from income or life expectancy; it takes geographic common sense. ${country(c.cc)} ranks #${rank} of the ${countries.length} sample countries, and the right answer is ${f.fmt(c.pop)}.`;
  }
  const p = PREDICT[k].find((x) => !blanks.includes(x));
  const pf = FACTS[p];
  const v = (x, key) => (logKeys.has(key) ? Math.log(x[key]) : x[key]);
  const near = countries.filter((x) => x.cc !== c.cc).sort((a, b) => Math.abs(v(a, p) - v(c, p)) - Math.abs(v(b, p) - v(c, p))).slice(0, 15);
  const vals = near.map((x) => x[k]);
  return `The clue is [${pf.label} ${pf.fmt(c[p])}]. Among the 15 countries closest to it, the median ${f.label} is ${f.fmt(median(vals))} (typical range ${f.fmt(quant(vals, 0.1))} to ${f.fmt(quant(vals, 0.9))}); ${country(c.cc)} is actually ${f.fmt(c[k])}.`;
}

/** The earthquake-brief explanation for one blank, using the pool of other days as the base rate. */
export function quakeTip(k, s, pool) {
  const f = FACTS[k];
  const others = pool.filter((x) => x.d !== s.d);
  const med = median(others.map((x) => x[k]));
  const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(0)}%` : '—');
  const base = `Over the last ${others.length} days the median is ${f.fmt(med)}`;
  if (k === 'q25') return `${base}. M4.5+ is usually ${pct(median(others.map((x) => x.q45)), median(others.map((x) => x.q25)))} of M2.5+: divide the day's ${s.q45} by that ratio to back out the total (actual ${s.q25}, a ${pct(s.q45, s.q25)} share).`;
  if (k === 'q45') return `${base}. Each 0.5 step up in magnitude roughly halves the count: the day had ${s.q25} quakes of M2.5+, and M4.5+ is ${pct(s.q45, s.q25)} of them (actual ${s.q45}).`;
  if (k === 'q5') return `${base}. Counts fall with magnitude (the Gutenberg–Richter law): M5+ is typically ${pct(median(others.map((x) => x.q5)), median(others.map((x) => x.q45)))} of M4.5+, and the day had ${s.q5} / ${s.q45}.`;
  if (k === 'qmag') {
    const sim = [...others].sort((a, b) => Math.abs(a.q5 - s.q5) - Math.abs(b.q5 - s.q5)).slice(0, 12).map((x) => x.qmag);
    return `The day had ${s.q5} quakes of M5+. Among the ${sim.length} days with the closest M5+ counts, the median strongest quake is M${median(sim).toFixed(1)}. The actual strongest was M${s.qmag.toFixed(1)} (${s.magPlace}).`;
  }
  const deepShare = others.filter((x) => x.qdep > 300).length / others.length;
  return `${base}; on about ${(deepShare * 100).toFixed(0)}% of days the deepest quake is below 300 km, and such deep quakes cluster in the Tonga–Fiji, Indonesia, Japan and South America subduction zones. The deepest that day was ${s.qdep} km (${s.depPlace}).`;
}

/** Live: yesterday-ish (UTC, LAG_DAYS back) tally from the USGS FDSN API. Returns null when the day is unusable. */
export function toQuake(geojson, date) {
  return dayStats(geojson?.features, date);
}

export default {
  meta: {
    num: 96,
    slug: 'missing-number',
    title: 'Missing Number',
    tagline: 'A data news brief with three numbers blanked out. Read the numbers that are left and fill in the gaps.',
    category: 'model',
    data: 'live',
    howTo: [
      'Each day brings one brief with three numbers blanked out as [A], [B] and [C]. Every 3rd, 6th, 9th... puzzle is a USGS global earthquake brief (real tallies from a few days ago); the other days show a country\'s 2022 population and living-standards profile (World Bank).',
      'The numbers left in view are your clues: earthquake counts fall off steadily with magnitude, and wealthier countries have higher internet use, longer lives and more urbanization.',
      'Population and GDP per capita span huge ranges, so their sliders are logarithmic (by order of magnitude); the rest score by how many units you are off.',
      'Each blank is worth 100 points, and the three are averaged. The result page shows how each blank could have been worked out.',
    ],
    scoring: 'Population and GDP per capita: off by 2x is about 37 points. The rest decay with absolute error, and an error equal to the tolerance scores about 37 (life expectancy 4 years, shares 15 percentage points, population change 8 points, unemployment 4 points, quake counts 25/8/3, magnitude 0.5, depth 100 km).',
    sources: [
      { name: 'USGS Earthquake Catalog (FDSN Event API)', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', note: 'Earthquake brief: worldwide M2.5+ by UTC day, fetched live for the day 3 days back' },
      { name: 'World Bank Open Data API', url: 'https://data.worldbank.org/', note: 'SP.POP.TOTL, NY.GDP.PCAP.CD, SP.DYN.LE00.IN, SP.URB.TOTL.IN.ZS, IT.NET.USER.ZS, SL.UEM.TOTL.ZS (2022)' },
    ],
    dataNote: 'There is no runtime LLM: the brief comes from a fixed template filled with real values, and which three numbers are blanked is decided randomly by the date. The earthquake brief queries USGS live in the browser (for the UTC day 3 days back, when the catalogue has been reviewed, so every player gets the same numbers) and falls back to a snapshot covering 2026-04-16 to 2026-10-12 on failure. The country brief uses World Bank 2022 data (annual indicators with no daily-updated version, so this part is a snapshot) and only includes the 122 countries with all six indicators, a population above 3 million and answers inside the slider range, so extremes such as the Central African Republic (life expectancy 18.8 years) are excluded.',
  },

  puzzle({ data, day, rng, pick }) {
    if (day % 3 === 0) {
      const s = data.live ?? pick(data.quakes);
      const blanks = rng.sample(QKEYS, 3).sort((a, b) => QKEYS.indexOf(a) - QKEYS.indexOf(b));
      return { kind: 'quake', s, blanks };
    }
    const c = pick(data.countries);
    const blanks = rng.sample(CKEYS, 3).sort((a, b) => CKEYS.indexOf(a) - CKEYS.indexOf(b)); // letters follow reading order
    return { kind: 'country', cc: c.cc, blanks };
  },

  async load(ctx) {
    if (ctx.day % 3 !== 0) return null; // country days use the (annual, final) snapshot
    const date = ctx.core.addDays(ctx.date, -LAG_DAYS);
    const next = ctx.core.addDays(date, 1);
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${date}&endtime=${next}&minmagnitude=2.5&orderby=time&limit=2000`;
    const raw = await ctx.fetchJSON(url, { timeout: 9000 });
    const live = toQuake(raw, date);
    if (!live) throw new Error(`USGS ${date}: unusable day`);
    ctx.log('live quake day', date, live);
    return { ...ctx.data, live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const quake = p.kind === 'quake';
    const c = quake ? p.s : ctx.data.countries.find((x) => x.cc === p.cc);
    const slot = Object.fromEntries(p.blanks.map((k, i) => [k, LETTERS[i]]));
    ctx.log('story', p.kind, quake ? c.d : c.cc, p.blanks);

    const body = (quake ? quakeParts(c) : storyParts(c)).map((s) => {
      if (typeof s === 'string') return s;
      return slot[s.k]
        ? ui.h('b', { style: { color: 'var(--accent)' }, class: 'mono' }, `[${slot[s.k]}]`)
        : ui.h('b', { class: 'mono' }, FACTS[s.k].fmt(c[s.k]));
    });
    ctx.stage.append(ui.panel(
      { kicker: quake ? 'Today\'s brief · live data' : 'Today\'s brief', title: quake ? 'Global earthquake report: where did the numbers go?' : `${country(c.cc)}: where did the numbers go?` },
      ui.h('p', { style: { lineHeight: 1.9, margin: 0 } }, ...body)));

    const results = [];
    for (const [i, k] of p.blanks.entries()) {
      const f = FACTS[k];
      const r = await ctx.estimate({
        title: `[${LETTERS[i]}] ${f.label}`,
        prompt: `What is [${LETTERS[i]}] in the brief?`,
        answer: c[k], min: f.min, max: f.max, log: !!f.log, step: f.step,
        format: f.fmt, scoring: f.scoring, scale: f.scale,
      });
      ctx.log('blank', k, c[k], r.guess, r.score);
      results.push(r);
    }
    const res = ctx.combine(results);
    const tip = (k) => (quake ? quakeTip(k, c, ctx.data.quakes) : countryTip(k, c, ctx.data.countries, p.blanks));
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [{ key: 'slot', label: 'Blank' }, { key: 'what', label: 'Metric' }, { key: 'ans', label: 'Answer', num: true }, { key: 'you', label: 'Your guess', num: true }],
        rows: p.blanks.map((k, i) => ({ slot: LETTERS[i], what: FACTS[k].label, ans: FACTS[k].fmt(c[k]), you: results[i].guess != null ? FACTS[k].fmt(results[i].guess) : '—' })),
      }),
      ...p.blanks.map((k, i) => ui.h('div', { class: 'small ink2' }, `[${LETTERS[i]}] ${FACTS[k].label}: ${tip(k)}`)));
    return res;
  },
};
