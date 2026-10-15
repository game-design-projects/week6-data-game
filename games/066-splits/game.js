// #66 Splits — a real Boston Marathon runner's first 25K; predict the finish time.
export const KM = [5, 10, 15, 20, 25];
export const hms = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
export const pace = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
/** seconds per km of each 5K segment */
export const segPaces = (sp) => sp.map((t, i) => (t - (sp[i - 1] ?? 0)) / 5);
/** finish time (s) if the pace of the 25K mark were held for the rest of the 42.195K */
export const evenProjection = (t25) => t25 * (42.195 / 25);
/** slowdown of the last 17.2K vs the first 25K, in % (positive = faded) */
export const fadePct = (t25, fin) => ((fin - t25) / (t25 * (17.195 / 25)) - 1) * 100;
const YEAR = { 2015: '2015: cold, headwind and rain', 2016: '2016: sunny and hot (about 21\u00b0C / 70\u00b0F), the famous \u201cheat year\u201d', 2017: '2017: on the warm side (about 22\u00b0C / 72\u00b0F), cloudless' };

export default {
  meta: {
    num: 66,
    slug: 'splits',
    title: 'Splits',
    tagline: 'A real marathoner\'s splits for the first 25 km. Predict the finish time. Spotting who will fade is the skill.',
    category: 'society',
    data: 'snapshot',
    howTo: [
      'The chart shows a real Boston Marathon runner\'s pace (time per km) for each 5K segment, 2015-2017 races, up to the 25 km mark only.',
      'The lazy approach is an even-pace projection: hold the 25K average pace (the dashed line) to the finish. But most runners slow down late in the race.',
      'Use age, gender, whether the first half was speeding up or slowing down, and that year\'s weather, then drag the slider to estimate the finish time.',
      'The smaller the error the higher the score: 4% off earns about 45 points, 10% off about 14. Beating the dashed line means you read the fade.',
    ],
    scoring: '100 \u00d7 e^(\u2212relative error / 5%).',
    sources: [
      { name: 'Boston Marathon 2015–2017 official results (BAA)', url: 'https://www.baa.org/races/boston-marathon/results', note: 'CSV obtained through the GitHub mirror nispano/Data-Analysis-of-the-Boston-Marathon-Results-2015-2017' },
    ],
    dataNote: 'The idea called for NYRR results, but the NYRR site only allows manual lookups that cannot be scripted, so official Boston Marathon results (BAA) are used instead. From 79,000 results with complete 5K-40K splits, 144 runners were sampled stratified by late-race fade \u00d7 year (results that slowed by more than 40%, such as injured or walking finishers, are excluded since they cannot be predicted). Names are not shown, for privacy. Each year\'s weather is a publicly reported summary, not part of the dataset. The data is a static snapshot: official results offer no CORS-enabled API, so there is no live data.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.runners).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const r = ctx.data.runners.find((x) => x.id === p.id);
    const t25 = r.sp[4];
    const ev = evenProjection(t25);
    const pc = segPaces(r.sp);
    ctx.log('runner', { y: r.y, t25, ev });

    const bars = pc.map((v, i) => ({ seg: `${KM[i] - 5}–${KM[i]}K`, v: v / 60 }));
    const lo = Math.min(...bars.map((b) => b.v), ev / 42.195 / 60), hi = Math.max(...bars.map((b) => b.v), ev / 42.195 / 60);
    const chart = await ui.plot((Plot, c) => ({
      height: 220,
      marginLeft: 48,
      marginTop: 24,
      x: { label: null, domain: bars.map((b) => b.seg) },
      y: { label: 'Pace, min/km', domain: [lo - (hi - lo) * 0.6 - 0.05, hi + (hi - lo) * 0.5 + 0.05], tickFormat: (v) => pace(v * 60) },
      marks: [
        Plot.ruleY([ev / 42.195 / 60], { stroke: c.bad, strokeDasharray: '4 3' }),
        Plot.lineY(bars, { x: 'seg', y: 'v', stroke: c.accent, strokeWidth: 2 }),
        Plot.dot(bars, { x: 'seg', y: 'v', fill: c.accent, r: 5, tip: true }),
        Plot.text(bars, { x: 'seg', y: 'v', text: (b) => pace(b.v * 60), dy: -14, fill: c.ink, fontFamily: 'monospace' }),
      ],
    }));

    ctx.stage.append(ui.panel({ kicker: 'First 25 km', title: `${r.g === 'M' ? 'Man' : 'Woman'}, age ${r.age}, ${r.cc}` },
      chart,
      ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '6px', flexWrap: 'wrap' } },
        ui.h('span', `25K time ${hms(t25)}`),
        ui.h('span', { style: { color: 'var(--bad)' } }, `- - dashed line = 25K average pace ${pace(t25 / 25)}`)),
      ui.h('div', { class: 'small muted', style: { marginTop: '6px' } }, `Race: Boston Marathon, ${YEAR[r.y]}. The famous Heartbreak Hill comes around 33K, before the finish.`)));

    const res = await ctx.estimate({
      title: 'What time does he or she finish?',
      prompt: 'Estimate the finish time (net time).',
      answer: r.fin / 60,
      min: Math.floor((t25 * 1.5) / 60),
      max: Math.ceil((t25 * 2.4) / 60),
      initial: Math.round(ev / 60),
      step: 1,
      format: (v) => hms(v * 60),
      scoring: 'pct',
      scale: 0.05,
    });

    const f = fadePct(t25, r.fin);
    const tail = r.rest.map((t, i) => (t - (r.rest[i - 1] ?? t25)) / (i === 3 ? 2.195 : 5));
    const firstTrend = (pc[4] - pc[0]) / pc[0] * 100;
    const worst = tail.indexOf(Math.max(...tail.slice(0, 3)));
    const segName = ['25–30K', '30–35K', '35–40K'][worst];
    const gGuess = res.guess * 60;
    const errG = Math.abs(gGuess - r.fin) / r.fin * 100, errE = Math.abs(ev - r.fin) / r.fin * 100;
    res.detail = ui.kv([
      ['Actual finish', hms(r.fin)],
      ['Your estimate', `${hms(gGuess)} (${errG.toFixed(1)}% off) \u00b7 ${errG < errE ? 'better than the even projection' : 'not better than the even projection'}`],
      ['Even projection', `${hms(ev)} (${errE.toFixed(1)}% off, ${r.fin >= ev ? 'under' : 'over'}estimating by ${hms(Math.abs(r.fin - ev))})`],
      ['Late fade', `${f >= 0 ? '+' : ''}${f.toFixed(1)}% (average pace of the last 17.2K versus the first 25K)`],
      ['Late paces', `25-30K ${pace(tail[0])} \u00b7 30-35K ${pace(tail[1])} \u00b7 35-40K ${pace(tail[2])} \u00b7 final stretch ${pace(tail[3])}`],
      ['Pattern', `Within the first 25K, 20-25K was ${firstTrend > 1 ? `${firstTrend.toFixed(0)}% slower than the first 5K, so the fade had already started` : firstTrend < -1 ? `${(-firstTrend).toFixed(0)}% faster than the first 5K, a runner getting stronger` : 'about the same as the first 5K, a steady rhythm'}. ` +
        (f > 8 ? `The slowest late segment was ${segName} (${pace(tail[worst])}), a clear fade: an even projection badly underestimates.` : f > 2 ? `A mild late fade (slowest ${segName} at ${pace(tail[worst])}); 3-8% is normal for amateurs.` : 'Nearly even or faster late (a negative split), typical of experienced runners.') +
        (r.y === 2016 ? ' That year was hot, and more runners faded.' : r.y === 2015 ? ' That year had a headwind and rain, so times were slow overall.' : '')],
    ]);
    return res;
  },
};
