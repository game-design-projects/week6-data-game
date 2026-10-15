// #67 Pyramid — read a population pyramid, name the country.
import { haversineKm, fmtKm, fmtCompact } from '../../engine/core.js';


/** ↑ if the answer is larger than the guess, ↓ if smaller, ✓ when within tol. */
export function dir(guess, answer, tol = 0) {
  if (Math.abs(answer - guess) <= tol) return '✓';
  return answer > guess ? '↑' : '↓';
}

/** Short description of the shape of a pyramid from its summary stats. */
export function shapeOf(c) {
  if (c.med < 20) return 'A true pyramid, very wide at the base and sharp at the top: nearly half the population are children, with high birth rates and shorter lives.';
  if (c.med < 30) return 'A still-young, bottom-heavy structure: birth rates are fairly high but starting to slow.';
  if (c.med < 40) return 'A maturing, column-like structure: falling birth rates and a large working-age majority.';
  return 'An inverted, aging structure: a narrowing base and a fattening top, with few children and many elders.';
}

const band = (c, i) => c.f[i] + c.m[i];

/** Sum of absolute differences between two pyramids (percentage points). */
export function shapeDist(a, b) {
  let d = 0;
  for (let i = 0; i < a.f.length; i++) d += Math.abs(band(a, i) - band(b, i));
  return d;
}

/** Puzzle-specific observations: which features of this pyramid identify it. */
export function patterns(c, ages) {
  const out = [];
  const base = band(c, 0), mid = band(c, 5);
  out.push(`Ages 0–4 make up ${base.toFixed(1)}% and ages 25–29 make up ${mid.toFixed(1)}%: the base is ${(base / mid).toFixed(2)}x the waist${base / mid > 1.25 ? ' (still expanding fast)' : base / mid < 0.8 ? ' (fewer newborns than young adults, so fertility is below replacement)' : ' (births are roughly stable)'}.`);
  const mw = c.m.slice(4, 11).reduce((a, b) => a + b, 0), fw = c.f.slice(4, 11).reduce((a, b) => a + b, 0);
  if (mw / fw > 1.12) out.push(`The male-to-female ratio at ages 20–54 is about ${(mw / fw).toFixed(2)}: clearly more men, usually a sign of large-scale migrant labor.`);
  else if (mw / fw < 0.95) out.push(`The male-to-female ratio at ages 20–54 is only ${(mw / fw).toFixed(2)}: more women, common where men work abroad or die earlier.`);
  const old = c.f[16] + c.m[16];
  if (old >= 3.5) out.push(`Ages 80+ make up ${old.toFixed(1)}%, a clearly fat top: a long-lived, low-birth, aging society.`);
  else if (old <= 0.5) out.push(`Ages 80+ are under ${Math.max(old, 0.1).toFixed(1)}%, so the top nearly vanishes: shorter life expectancy and a very young population.`);
  let peak = 0;
  for (let i = 1; i < 17; i++) if (band(c, i) > band(c, peak)) peak = i;
  if (peak >= 3) out.push(`The widest band is ages ${ages[peak]} (${band(c, peak).toFixed(1)}%), wider than the youngest band: a baby-boom generation sits at this age.`);
  let worst = null;
  for (let i = 1; i < 14; i++) {
    const r = band(c, i) / ((band(c, i - 1) + band(c, i + 1)) / 2);
    if (r < 0.85 && (!worst || r < worst.r)) worst = { i, r };
  }
  if (worst) out.push(`Ages ${ages[worst.i]} dip sharply (only ${Math.round(worst.r * 100)}% of the average of the neighboring bands): a gap left by a birth slump or emigration.`);
  const dep = ((c.u15 + c.o65) / (100 - c.u15 - c.o65)) * 100;
  out.push(`Dependency ratio (under 15 plus 65+, relative to ages 15–64) is about ${Math.round(dep)}%, with children at ${c.u15}% and elders at ${c.o65}%.`);
  return out;
}

export default {
  meta: {
    num: 67,
    slug: 'pyramid',
    title: 'Pyramid',
    tagline: 'Read the population pyramid. Name the country.',
    category: 'society',
    data: 'snapshot',
    howTo: [
      'The chart is one country\'s 2024 population pyramid by age and sex (men on the left, women on the right, as a percentage of the total population).',
      'Pick countries from the list, up to 6 guesses. Each wrong guess unlocks another clue.',
      'Each guess tells you whether the answer\'s median age is higher or lower, whether its population is bigger or smaller, whether it is in the same region, and how far apart the two countries are (measured between capitals).',
      'Tips: a wide base means young and high fertility; a thin waist means emigration or historical trauma; a fat top means aging; a male-heavy middle often means migrant workers.',
    ],
    scoring: '100 points for a correct first guess, about 17 fewer for each extra guess, and 0 if all 6 miss.',
    sources: [
      { name: 'World Bank Open Data (SP.POP.*.FE/MA, from UN World Population Prospects)', url: 'https://data.worldbank.org/indicator/SP.POP.TOTL' },
      { name: 'UN World Population Prospects', url: 'https://population.un.org/wpp/' },
    ],
    dataNote: 'The UN WPP site only offers large file downloads, so this uses the same WPP age/sex population data mirrored by the World Bank API (2024 estimates, 5-year bands, 80+ merged). Median age is linearly interpolated from the 5-year bands (80+ counted as 80–90). Includes 159 countries and territories with over 1 million people (including Hong Kong and Puerto Rico). The World Bank API needs no key but makes no CORS guarantee, so the data ships as a snapshot.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.countries).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const byId = new Map(ctx.data.countries.map((c) => [c.id, c]));
    const ans = byId.get(p.id);
    const ages = ctx.data.ages.map((a) => (a === '80UP' ? '80+' : `${+a.slice(0, 2)}–${+a.slice(2)}`));
    ctx.log('answer', ans.id);

    const c0 = ui.colors();
    const bars = [];
    ages.forEach((a, i) => {
      bars.push({ age: a, sex: 'Men', v: -ans.m[i] }, { age: a, sex: 'Women', v: ans.f[i] });
    });
    const maxV = Math.ceil(Math.max(...ans.f, ...ans.m) * 1.1);
    const lum = (hex) => { const m = /^#?([0-9a-f]{6})/i.exec(String(hex).trim()); return m ? parseInt(m[1].slice(0, 2), 16) * 0.3 + parseInt(m[1].slice(2, 4), 16) * 0.6 + parseInt(m[1].slice(4), 16) * 0.1 : 0; };
    const maleColor = lum(c0.paper) < 128 ? '#6aa0e8' : '#2f6bb8';
    const pyramid = await ui.plot((Plot, c) => ({
      height: 340,
      marginLeft: 44,
      x: { label: '% of total population', domain: [-maxV, maxV], tickFormat: (d) => Math.abs(d) },
      y: { label: null, domain: ages, reverse: false },
      marks: [
        Plot.barX(bars, { x: 'v', y: 'age', fill: (d) => (d.sex === 'Men' ? maleColor : c.accent), title: (d) => `Ages ${d.age}, ${d.sex}: ${Math.abs(d.v)}%` }),
        Plot.ruleX([0], { stroke: c.ink }),
      ],
    }));

    const legend = ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '6px' } },
      ui.h('span', ui.h('span', { style: { color: maleColor } }, '■'), ' Men (left)'),
      ui.h('span', ui.h('span', { style: { color: 'var(--accent)' } }, '■'), ' Women (right)'));

    const clues = [
      ui.h('div', pyramid, legend),
      `Ages 0–14 make up ${ans.u15}%, ages 65+ make up ${ans.o65}%, and women ${ans.fshare}%.`,
      `Median age is about ${ans.med}. ${shapeOf(ans)}`,
      `World Bank income group: ${ans.income}.`,
      `Region: ${ans.region}. Total population is about ${fmtCompact(ans.pop)}.`,
      `The country name starts with “${ans.name[0]}”.`,
    ];

    const options = ctx.data.countries.map((c) => ({ id: c.id, label: c.name, aliases: [c.cc, c.id] }));
    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: 6,
      title: 'Which country is this?',
      placeholder: 'Type a country, e.g. Kenya or KEN…',
      clues,
      cluesTitle: 'Pyramid and clues',
      columns: ['Median age', 'Pop.', 'Same region', 'Distance'],
      near: (g, a) => haversineKm(byId.get(g.id), byId.get(a.id)) < 1500,
      feedback: (g) => {
        const gc = byId.get(g.id);
        const hit = gc.id === ans.id;
        const dm = dir(gc.med, ans.med, 1.5);
        const dp = dir(Math.log(gc.pop), Math.log(ans.pop), 0.25);
        const km = haversineKm(gc, ans);
        return [
          { text: `${gc.med} ${dm}`, num: true, state: hit || dm === '✓' ? 'hit' : undefined },
          { text: `${fmtCompact(gc.pop)} ${dp}`, num: true, state: hit || dp === '✓' ? 'hit' : undefined },
          { text: gc.region === ans.region ? 'Yes' : 'No', state: gc.region === ans.region ? 'hit' : undefined },
          { text: hit ? '0 km' : fmtKm(km), num: true, state: km < 1500 ? 'near' : undefined },
        ];
      },
    });
    ctx.log('result', res.score);

    const peers = ctx.data.countries.filter((c) => c.id !== ans.id).sort((a, b) => shapeDist(a, ans) - shapeDist(b, ans)).slice(0, 3);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `Answer: ${ans.name}, ${ctx.data.year}.`),
      ui.kv([
        ['Population', fmtCompact(ans.pop)],
        ['Median age', `${ans.med}`],
        ['0–14 / 65+', `${ans.u15}% / ${ans.o65}%`],
        ['Region · income', `${ans.region} · ${ans.income}`],
        ['Most similar shapes', peers.map((c) => c.name).join(', ')],
      ]),
      ui.h('div', { class: 'small ink2' }, shapeOf(ans)),
      ui.h('div', { class: 'ds-stack small' }, ui.h('b', 'What gives this pyramid away'), ...patterns(ans, ages).map((t) => ui.h('div', { class: 'ink2' }, '· ' + t))));
    return res;
  },
};
