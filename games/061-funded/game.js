// #61 Funded — a Kickstarter pitch; guess what % of its goal it raised.
export const pctOf = (pledged, goal) => (goal > 0 ? (pledged / goal) * 100 : 0);
export const impliedPct = (backers, goal, avgPledge = 98) => pctOf(backers * avgPledge, goal);
export const FALLBACK_AVG = 98;
export const avgFor = (data, it) => data.parAvg?.[it.par] ?? FALLBACK_AVG;

export default {
  meta: {
    num: 61,
    slug: 'funded',
    title: 'Funded',
    tagline: 'A Kickstarter pitch: goal, backer count and blurb are all laid out. Guess what percent of its goal it ended up raising.',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      'Read the pitch blurb, its category, the goal (converted to US dollars) and the campaign length.',
      'The clues include the number of backers. The average backer pledges roughly $50-120 (more for technology and film, less for comics and games), so backers \u00d7 average pledge \u00f7 goal is a good starting point.',
      'Pick a percentage on the log slider: 100% means it just hit its goal, anything under 100% means it failed, and a few thousand percent is a runaway hit.',
      'Scoring is by the factor you are off: 2x off earns about 42 points, 10x off about 6, and a bullseye earns 100.',
    ],
    scoring: 'Log error: 100 \u00d7 e^(\u2212|log10(guess/actual)| / 0.35).',
    sources: [
      { name: 'Kickstarter datasets (monthly Web Robots scrape)', url: 'https://webrobots.io/kickstarter-datasets/', note: 'CSV from Oct 12, 2026' },
    ],
    dataNote: '146 projects were sampled, stratified by funding ratio, from more than 49,000 finished (successful or failed) projects. Only projects with English copy and at least 1 backer were kept; projects whose copy mentions amounts or outcomes directly, and adult content, were removed. Goals are converted to US dollars with each project\'s static_usd_rate. Kickstarter has no open cross-origin API (the official site refuses scripted access), so this is a snapshot from Oct 12, 2026, not live data.',
  },

  puzzle({ data, pick }) {
    return { i: data.items.indexOf(pick(data.items)) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const it = ctx.data.items[p.i];
    ctx.log('project', it.n, 'pct', it.pct);
    const avgP = avgFor(ctx.data, it);
    const hint = impliedPct(it.backers, it.goal, avgP);
    ctx.stage.append(ui.panel({ kicker: it.par + ' · ' + it.cat, title: it.n },
      ui.stack(ui.quote(it.b),
      ui.grid(120,
        ui.stat({ label: 'Goal', value: core.fmtMoney(it.goal) }),
        ui.stat({ label: 'Backers', value: core.fmtNum(it.backers) }),
        ui.stat({ label: 'Campaign length', value: it.days + ' days' }),
        ui.stat({ label: 'From', value: it.loc || it.cc, sub: 'launched ' + it.year }),
      ),
      ui.row(ui.badge(it.staff ? 'Staff Pick' : 'Not a Staff Pick', it.staff ? 'good' : undefined)))));
    const res = await ctx.estimate({
      title: 'What percent of its goal did it raise?',
      answer: it.pct, min: 1, max: 20000, log: true, step: 1, initial: 100,
      format: (v) => core.fmtNum(Math.round(v)) + '%',
      scoring: 'log', scale: 0.35,
    });
    const avg = it.pledged / it.backers;
    res.detail = ui.kv([
      ['Answer', `${core.fmtNum(it.pct)}% (${it.pct >= 100 ? 'funded' : 'missed its goal, failed'})`],
      ['Actually raised', `${core.fmtMoney(it.pledged)} of a ${core.fmtMoney(it.goal)} goal`],
      ['Average pledge', `${core.fmtMoney(avg)} (typical for ${it.par}: about ${core.fmtMoney(avgP)})`],
      ['How to reason', `${core.fmtNum(it.backers)} backers \u00d7 ${core.fmtMoney(avgP)} \u00f7 goal \u2248 ${core.fmtNum(Math.round(hint))}%, which is ${(Math.max(hint, it.pct) / Math.min(hint, it.pct)).toFixed(1)}x from the real value.`],
      ['Pattern', avg >= avgP * 1.5 ? `This project\'s average pledge (${core.fmtMoney(avg)}) is well above the typical ${it.par} figure, so estimating with the typical value runs low.` : avg <= avgP / 1.5 ? `This project\'s average pledge (${core.fmtMoney(avg)}) is well below the typical ${it.par} figure, so estimating with the typical value runs high.` : `The average pledge is close to the typical ${it.par} figure, so backers \u00d7 average \u00f7 goal lands near the truth.`],
      ['Outcome', it.pct >= 100 ? (it.staff ? 'Most Staff Pick projects succeed; the lower the goal, the easier it is to overshoot.' : 'Pledges keep piling up after the goal is hit, and small-goal projects can easily run to several hundred percent.') : 'Kickstarter is all or nothing: miss the goal and the creator gets nothing. Failed projects mostly stall on too few backers.'],
      ['Link', it.url ? ui.h('a', { href: it.url, target: '_blank', rel: 'noopener' }, it.url) : '—'],
    ]);
    return res;
  },
};
