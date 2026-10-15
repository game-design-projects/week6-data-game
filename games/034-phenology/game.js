// #34 Phenology — a species' weekly observation curve in one country; name the species,
// then predict when the same species peaks in another country.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Month/day label for the start of week w (1..52) of a non-leap year. */
export function weekDate(w) {
  let doy = (w - 1) * 7;
  let m = 0;
  while (doy >= MD[m]) { doy -= MD[m]; m++; }
  return { m: m + 1, d: doy + 1 };
}
export const weekLabel = (w) => { const { m, d } = weekDate(w); return `Week ${w} (${MON[m - 1]} ${d})`; };
/** Circular distance between two weeks of the year (0..26). */
export const weekDist = (a, b) => { const d = Math.abs(a - b) % 52; return Math.min(d, 52 - d); };
/** Score 0..1: full marks on the exact week, ~0.37 at 6 weeks off. */
/** Number of weeks at or above half of the peak (0..100 normalised curve). */
export const seasonWidth = (c) => c.filter((v) => v >= 50).length;
export const weekScore = (guess, answer) => Math.exp(-weekDist(guess, answer) / 6);

const GROUP_EN = { Aves: 'Birds', Insecta: 'Insects', Plantae: 'Plants', Fungi: 'Fungi', Reptilia: 'Reptiles', Amphibia: 'Amphibians', Mammalia: 'Mammals' };
const SOUTH = new Set(['AU', 'NZ']);
const name = (s) => { const n = s.en || s.sci; return n[0].toUpperCase() + n.slice(1); };

export default {
  meta: {
    num: 34,
    slug: 'phenology',
    title: 'Phenology',
    tagline: 'One species\' weekly sightings across a year in one country. Name the species, then predict when it peaks in another country.',
    category: 'science',
    data: 'snapshot',
    howTo: [
      'The curve shows how often iNaturalist citizen scientists spotted one species through the year, as a share of all sightings of its group, which cancels out the "everyone goes outside in summer" bias.',
      'Step 1: pick which of 5 related species this curve belongs to. A narrow peak means strong seasonality (migrating birds, flowering); a wide one means it is around all year.',
      'Step 2: in which week does the same species peak in another country? Remember the seasons are reversed between hemispheres, and latitude shifts the peak earlier or later.',
      'Step 1 is worth a third. Step 2 is scored by weeks off: 0 weeks is full marks, about 6 weeks off drops to roughly a third (the year wraps around).',
    ],
    scoring: 'Step 1: 33 points for the right species. Step 2: 67 × e^(−weeks off / 6).',
    sources: [
      { name: 'iNaturalist API · observations/histogram (research grade)', url: 'https://api.inaturalist.org/v1/docs/#!/Observations/get_observations_histogram' },
      { name: 'iNaturalist API · observations/species_counts', url: 'https://api.inaturalist.org/v1/docs/#!/Observations/get_observations_species_counts' },
    ],
    dataNote: 'Snapshot data (95 puzzles, 132 species: birds, insects, plants, amphibians). Research-grade observations from the US, Canada, UK, Australia and New Zealand, normalized as "species sightings per week ÷ all sightings of the same group in that region per week" and smoothed over 3 weeks. The curve shows the season in which people see a species, which is not strictly its biological phenology. Step 2 only uses puzzles where the naive guess (same week in the same hemisphere, shifted half a year across hemispheres) is off by 3+ weeks, so you need to know the species. Not live: these are yearly seasonal curves that barely change day to day. Photos belong to their authors, via iNaturalist.',
  },

  puzzle({ data, rng, pick }) {
    const p = pick(data.puzzles);
    return { s: p.s, a: p.a, b: p.b, o: rng.shuffle([p.s, ...p.o]) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const sp = ctx.data.species;
    const ans = sp[p.s];
    const A = ans.curves[p.a], B = ans.curves[p.b];
    const places = ctx.data.places;
    ctx.log('phenology', { species: ans.sci, a: p.a, b: p.b, peakA: A.peak, peakB: B.peak });

    const rows = (c, label) => c.c.map((v, i) => ({ w: i + 1, v, label }));
    const ticks = Array.from({ length: 12 }, (_, i) => Array.from({ length: 52 }, (_, k) => k + 1).find((w) => weekDate(w).m === i + 1 && weekDate(w).d <= 7));
    const monthOf = (w) => MON[weekDate(w).m - 1];
    const ticks2 = ticks.filter((_, i) => i % 2 === 0);
    const chart = (series, height = 220) => ui.plot((Plot, c) => ({
      height, marginLeft: 12,
      x: { domain: [1, 52], ticks: ticks2, tickFormat: monthOf, label: null },
      y: { axis: null, domain: [0, 105] },
      marks: [
        Plot.areaY(series[0].rows, { x: 'w', y: 'v', fill: c.accent, fillOpacity: 0.18, curve: 'monotone-x' }),
        ...series.map((s, i) => Plot.lineY(s.rows, { x: 'w', y: 'v', stroke: [c.accent, c.ink][i], strokeWidth: 2.5, curve: 'monotone-x' })),
        Plot.tip(series[0].rows, Plot.pointerX({ x: 'w', y: 'v', title: (d) => `${weekLabel(d.w)}\nRelative frequency ${d.v}%` })),
      ],
    }), { height });

    ctx.stage.append(ui.panel(
      { kicker: `${places[p.a]} (${SOUTH.has(p.a) ? 'southern' : 'northern'} hemisphere) · 52 weeks`, title: 'Whose season is this?' },
      await chart([{ label: places[p.a], rows: rows(A) }]),
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px', marginTop: '12px' } },
        ui.stat({ label: 'Group', value: GROUP_EN[ans.g] || ans.g }),
        ui.stat({ label: 'Observations', value: core.fmtNum(A.n), sub: 'research grade' })),
    ));

    const r1 = await ctx.rounds({
      title: 'Step 1: name the species',
      rounds: [{
        prompt: `All are ${(GROUP_EN[ans.g] || ans.g).toLowerCase()}. Which one makes this curve in ${places[p.a]}?`,
        options: p.o.map((id) => ({ label: name(sp[id]), sub: sp[id].sci })),
        correct: p.o.indexOf(p.s),
        explain: `${name(ans)} (${ans.sci}) peaks in ${places[p.a]} at ${weekLabel(A.peak)}.`,
      }],
    });
    ctx.log('stage1', r1.score);

    ctx.stage.append(ui.callout(`${name(ans)} peaks in ${places[p.a]} at ${weekLabel(A.peak)}. What about the same species in ${places[p.b]} (${SOUTH.has(p.b) ? 'southern' : 'northern'} hemisphere)?`));
    const r2 = await ctx.estimate({
      title: `Step 2: when does it peak in ${places[p.b]}?`,
      answer: B.peak, min: 1, max: 52, step: 1, initial: 26, attempts: 1,
      scoring: weekScore, format: (v) => { const w = Math.round(v), { m, d } = weekDate(w); return `Wk ${w} · ${MON[m - 1]} ${d}`; },
    });
    ctx.log('stage2', { guess: r2.guess, answer: B.peak });

    const res = ctx.combine([
      { ...r1, score: r1.score * 33, max: 33 },
      { ...r2, score: r2.score * 0.67, max: 67 },
    ]);
    const shift = weekDist(A.peak, B.peak);
    const wA = seasonWidth(A.c), wB = seasonWidth(B.c);
    const signed = ((B.peak - A.peak + 78) % 52) - 26;
    const cross = SOUTH.has(p.a) !== SOUTH.has(p.b);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ans.photo ? ui.h('img', { src: `https://inaturalist-open-data.s3.amazonaws.com/photos/${ans.photo.id}/medium.jpeg`, alt: ans.sci, onerror: (e) => { e.target.style.display = 'none'; }, style: { width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: 'var(--radius, 8px)' } }) : null,
      ui.kv([
        ['Species', `${name(ans)} (${ans.sci})`],
        [`Peak in ${places[p.a]}`, weekLabel(A.peak)],
        [`Peak in ${places[p.b]}`, weekLabel(B.peak)],
        ['Difference', `${shift} ${shift === 1 ? 'week' : 'weeks'}${cross ? '; the hemispheres have opposite seasons' : ''}`],
        ['How to read it', `${places[p.a]}\'s curve spends ${wA} weeks above half its peak (${wA <= 8 ? 'a narrow peak, very seasonal' : wA <= 16 ? 'a season of medium length' : 'a wide peak, around all year'}), peaking in week ${A.peak}. ${places[p.b]} ${cross ? `is in the opposite hemisphere, so the seasons flip and the two peaks are ${shift} weeks apart (a full half year is 26)` : shift <= 2 ? 'is almost in sync' : `peaks ${shift} weeks ${signed > 0 ? 'later' : 'earlier'} than ${places[p.a]}`}, in week ${B.peak}, with a width of ${wB} weeks.`],
        ['Photo', ans.photo ? `${ans.photo.by || 'iNaturalist user'} · ${String(ans.photo.lic).toUpperCase()}` : '—'],
      ]),
      await chart([{ label: places[p.b], rows: rows(B) }, { label: places[p.a], rows: rows(A) }], 200),
      ui.h('div', { class: 'small muted' }, `Colored line: ${places[p.b]}. White line: ${places[p.a]}.` + (cross ? ' Across the equator, the seasons differ by about half a year.' : ' Same hemisphere: the peak shifts a few weeks with latitude, altitude and climate.')));
    return res;
  },
};
