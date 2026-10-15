// #31 Rent Index — guess a county's HUD Fair Market Rent for a 2-bedroom, then four higher/lower duels.

export const N_DUELS = 4;
export const EST_MAX = 80;
export const DUEL_PTS = 5;

/** Pick `n` distinct rivals whose 2BR FMR differs from the target by 8%–60% (close enough to need thought, never a tie). */
export function pickRivals(counties, target, rng, n = N_DUELS, minGap = 0.08, maxGap = 0.6) {
  const gap = (c) => Math.abs(c.fmr[2] - target.fmr[2]) / target.fmr[2];
  let ok = counties.filter((c) => c !== target && gap(c) >= minGap && gap(c) <= maxGap);
  if (ok.length < n) ok = counties.filter((c) => c !== target && gap(c) >= minGap);
  return rng.sample(ok, n);
}

/** Rescale to a 100-point total: estimate 80 + 5 per duel. */
export function scaleStages(est, duels) {
  const e = { ...est, score: Math.round((est.score / (est.max || 100)) * EST_MAX), max: EST_MAX };
  const d = { ...duels, score: duels.score * DUEL_PTS, max: duels.max * DUEL_PTS };
  return [e, d];
}

const pct = (a, b) => Math.round((a / b - 1) * 100);

export default {
  meta: {
    num: 31,
    slug: 'rent-index',
    title: 'Rent Index',
    tagline: 'Guess a US county\u2019s 2-bedroom Fair Market Rent (HUD FMR), then settle four higher-or-lower duels.',
    category: 'money',
    data: 'snapshot',
    howTo: [
      'You get the name, state, population and rent area of a US county (or a New England town). Guess its monthly rent for a 2-bedroom apartment (HUD Fair Market Rent, FY2026).',
      'Up to 3 tries; after each you are told to go higher or lower, and every extra try costs 10% of the points.',
      'Then four duels: this county against another, which has the higher 2-bedroom rent?',
      'Scoring is out of 100: the estimate is worth 80 (about 30 points at 20% off) and each duel is worth 5.',
    ],
    scoring: 'Estimate 80 points (decays with percentage error, 10% off per extra try) + 5 per correct duel, 100 in total.',
    sources: [{ name: 'HUD Fair Market Rents FY2026 (county level)', url: 'https://www.huduser.gov/portal/datasets/fmr.html', note: 'FY26_FMRs_revised.xlsx, with 2023 population' }],
    dataNote: 'FMR is the roughly 40th-percentile market rent HUD sets for housing assistance, not an average rent. The data covers only counties with at least 40,000 people (towns in New England; no overseas territories such as Guam). Counties in the same rent area share one FMR. HUD\u2019s official API needs a token and has no CORS, so we use a snapshot of the xlsx published on its site.',
  },

  puzzle({ data, pick, rng }) {
    const c = pick(data.counties);
    const rivals = pickRivals(data.counties, c, rng).map((r) => data.counties.indexOf(r));
    return { i: data.counties.indexOf(c), rivals };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const D = ctx.data;
    const c = D.counties[p.i];
    const $ = (v) => core.fmtMoney(v);
    ctx.log('county', c.name, c.st, c.fmr[2]);

    ctx.stage.append(ui.panel({ kicker: 'HUD FY2026 · 2-bedroom monthly rent', title: `${c.name}, ${c.st}` },
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px' } },
        ui.stat({ label: 'Population', value: core.fmtCompact(c.pop), sub: '2023' }),
        ui.stat({ label: `${c.st} median county`, value: $(D.stateMed[c.st]), sub: '2-bedroom' }),
        ui.stat({ label: 'US median county', value: $(D.nat), sub: '2-bedroom' })),
      ui.h('p', { class: 'small ink2', style: { marginTop: '10px' } }, `Rent area: ${c.area}`)));

    const r1 = await ctx.estimate({
      title: 'What is the monthly rent for a 2-bedroom here?',
      answer: c.fmr[2], min: 300, max: 5000, log: true, step: 5, initial: D.nat,
      format: $, attempts: 3, scoring: 'pct', scale: 0.2, tolerance: 0.03,
    });

    const rivals = p.rivals.map((i) => D.counties[i]);
    const r2 = await ctx.rounds({
      title: 'Higher or lower',
      rounds: rivals.map((o, k) => {
        const flip = (p.i + k) % 2;
        const opts = flip ? [o, c] : [c, o];
        return {
          prompt: 'Which has the higher 2-bedroom rent?',
          options: opts.map((x) => ({ label: `${x.name}, ${x.st}`, sub: `Pop. ${core.fmtCompact(x.pop)}` })),
          correct: opts[0].fmr[2] > opts[1].fmr[2] ? 0 : 1,
          explain: `${c.name} ${$(c.fmr[2])} vs ${o.name} ${$(o.fmr[2])}`,
        };
      }),
    });

    const [e, d] = scaleStages(r1, r2);
    const res = ctx.combine([e, d]);
    const ans = c.fmr[2];
    const sm = D.stateMed[c.st];
    const sameArea = D.counties.filter((x) => x !== c && x.area === c.area).length;
    const why = [
      `${c.name} has a 2-bedroom FMR of ${$(ans)}, ${Math.abs(pct(ans, sm))}% ${pct(ans, sm) >= 0 ? 'above' : 'below'} the ${c.st} median county (${$(sm)}) and ${Math.abs(pct(ans, D.nat))}% ${pct(ans, D.nat) >= 0 ? 'above' : 'below'} the US median county (${$(D.nat)}).`,
      ans > sm * 1.2 ? 'Well above the state median: most likely a metro core or a tourist or high-income area. Big counties near job centers are usually pricier.'
        : ans < sm * 0.85 ? 'Below the state median: a more rural or economically weaker area, with rents falling off with distance from big cities.'
        : 'Close to the state median: the state median in the clues was a good anchor.',
      c.metro ? 'Part of a metro area: counties in the same metro share one FMR, so a neighbor\u2019s price is a good reference.' : 'Not in a big metro area: rent is driven mainly by local income and housing stock.',
      `Each extra bedroom adds about ${pct(c.fmr[3], c.fmr[2])}% to the rent (2BR to 3BR).`,
    ].join(' ');
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['Answer', `${$(ans)} / month`],
        ['Your estimate', r1.guess != null ? $(r1.guess) : (r1.summary || '')],
        ['All sizes', `Studio ${$(c.fmr[0])} · 1BR ${$(c.fmr[1])} · 2BR ${$(c.fmr[2])} · 3BR ${$(c.fmr[3])} · 4BR ${$(c.fmr[4])}`],
        ['Rent area', `${c.area}${sameArea ? ` (${sameArea} other ${sameArea === 1 ? 'county or town' : 'counties or towns'} in the pool share this price)` : ''}`],
        ['Pattern', why]]));
    return res;
  },
};
