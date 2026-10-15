// #41 Gravity Assist — today's real planet positions (JPL Keplerian ephemeris) → rank flyby routes by total delta-v.
import { buildPuzzle, TARGETS, jdOf, position, phaseDeg, AU, STEP, NDEP, DEP_STRIDE } from './astro.js';

export const label = (names, via) => (via ? `${names[via]} flyby` : 'Direct');
/** route ids sorted from cheapest to most expensive */
export const rankRoutes = (routes) => routes.slice().sort((a, b) => a.dv - b.dv).map((r) => r.via ?? 'direct');
/** final score: 70 % ranking, 30 % the Δv estimate */
export const blend = (order, est) => Math.round(0.7 * order + 0.3 * est);
/** which term makes `r` cost more than the best route `b`: [text, extra km/s] */
export function culprit(r, b) {
  const parts = [
    ['a higher departure speed is needed', r.vinf - b.vinf], // positive = worse (vinf proxies the departure burn)
    ['extra correction burns are needed at the flyby', r.flyby.reduce((s, x) => s + x, 0) - b.flyby.reduce((s, x) => s + x, 0)],
    ['it arrives too fast relative to the target, so braking is costly', r.arr - b.arr],
  ];
  parts.sort((x, y) => y[1] - x[1]);
  return parts[0][1] > 0.15 ? parts[0][0] : 'all three terms run a bit higher';
}

export default {
  meta: {
    num: 41,
    slug: 'gravity-assist',
    title: 'Gravity Assist',
    tagline: 'Today\'s real planet positions are laid out in front of you. Leaving Earth, is it cheaper to fly direct or to slingshot off another planet? Rank the routes by fuel.',
    category: 'science',
    data: 'computed',
    howTo: [
      'The chart shows where the planets really are today (computed from JPL orbital elements): the big colored dots are today\'s positions, the thin lines trace where the slower planets travel over the next 14 months. The launch window stays open for 400 days from today.',
      'First estimate: roughly how many km/s of total Δv does the cheapest route need?',
      'Then rank: put the 4 routes (1 direct + 3 that each use one planet\'s gravity) in order of total Δv, lowest first. You get 3 submissions, and each tells you how many positions are right.',
      'Check the phasing: is the flyby planet actually on the way to the target? A massive planet like Jupiter can give a big boost, but if it is out of position the detour only costs more fuel.',
    ],
    scoring: '100 points total: ranking is worth 70 (a perfect 1st submission scores 70, the 2nd about 47, the 3rd about 23, with small partial credit for correct positions), and the Δv estimate is worth 30 (the smaller the multiplicative error, the higher).',
    sources: [
      { name: 'NASA JPL \u201cApproximate Positions of the Planets\u201d (Keplerian elements, 1800-2050)', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', note: 'Used to compute each day\'s planet positions and velocities in the browser' },
      { name: 'NASA JPL Horizons System', url: 'https://ssd.jpl.nasa.gov/api/horizons.api', note: 'Offline check only: at 90 checkpoints the orbital elements agree with the DE441 ephemeris to within 0.05 AU' },
      { name: 'Lambert problem + patched conics', url: 'https://en.wikipedia.org/wiki/Lambert%27s_problem', note: 'Finds the minimum Δv of each route' },
    ],
    dataNote: 'The Horizons API has no CORS (browsers cannot call it directly), so the game computes the day\'s planet positions locally from JPL\'s published Keplerian elements, and the data badge says \u201ccomputed\u201d rather than \u201clive\u201d. Δv comes from a simplified patched-conic model: the burn from a 300 km low orbit + the correction burn at the flyby planet (0 if the turn angle suffices) + the relative speed on arrival at the target (equivalent to stopping, without orbit insertion). Each route is minimized over a 400-day launch window (one departure every 40 days) and a grid of about 10 flight times, total flight time up to 14 years, zero-revolution Lambert arcs and a single flyby only, no deep-space maneuvers. The target planet rotates daily; if a target\'s four routes are too close in Δv (under 4% apart), the next target is used that day.',
  },

  puzzle({ data, date, pick }) {
    const p = buildPuzzle(data.elements, date, pick(TARGETS));
    return { date: p.date, target: p.target, routes: p.routes };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const d = ctx.data, el = d.elements, ZH = d.names;
    ctx.log('puzzle', p.date, p.target, p.routes.map((r) => `${r.via ?? 'direct'}:${r.dv}`).join(' '));
    const jd0 = jdOf(p.date);
    const vias = [...new Set(p.routes.map((r) => r.via).filter(Boolean))];
    const bodies = ['earth', p.target, ...vias];
    const sma = (b) => el[b].a[0];
    const reach = Math.max(...bodies.map(sma)) * 1.12;
    const sq = (r) => Math.sqrt(r / reach) * reach; // square-root radial scale keeps the inner planets legible
    const xy = (b, jd) => { const [x, y] = position(el, b, jd).map((c) => c / AU); const r = Math.hypot(x, y) || 1e-9; const k = sq(r) / r; return [x * k, y * k]; };
    const circle = (r) => Array.from({ length: 121 }, (_, i) => ({ x: sq(r) * Math.cos((i / 120) * 2 * Math.PI), y: sq(r) * Math.sin((i / 120) * 2 * Math.PI) }));
    const windowDays = (NDEP - 1) * DEP_STRIDE * STEP + 40;
    const first = bodies.map((b) => { const [x, y] = xy(b, jd0); return { b: ZH[b], x, y }; });
    const trails = bodies.filter((b) => sma(b) > 1.3).flatMap((b) =>
      Array.from({ length: Math.round(windowDays / 10) + 1 }, (_, i) => { const [x, y] = xy(b, jd0 + i * 10); return { b: ZH[b], x, y }; }));
    const chart = await ui.plot((Plot, c) => ({
      height: 380, aspectRatio: 1, axis: false, margin: 10,
      x: { domain: [-reach, reach] }, y: { domain: [-reach, reach] },
      color: { domain: bodies.map((b) => ZH[b]), range: c.series },
      marks: [
        ...bodies.map((b) => Plot.line(circle(sma(b)), { x: 'x', y: 'y', stroke: c.rule, strokeDasharray: '2 4' })),
        Plot.dot([{ x: 0, y: 0 }], { x: 'x', y: 'y', r: 7, fill: c.near, stroke: c.ink }),
        Plot.line(trails, { x: 'x', y: 'y', z: 'b', stroke: 'b', strokeWidth: 3, strokeOpacity: 0.55 }),
        Plot.dot(first, { x: 'x', y: 'y', fill: 'b', r: 8, stroke: c.paper, strokeWidth: 2 }),
        Plot.text(first.filter((t) => t.b !== ZH.earth), { x: 'x', y: 'y', text: 'b', fill: c.ink, dy: -15, fontWeight: 600, fontSize: 13 }),
        Plot.text(first.filter((t) => t.b === ZH.earth), { x: 'x', y: 'y', text: 'b', fill: c.ink, dy: 17, fontWeight: 600, fontSize: 13 }), // earth label below so it never covers Venus/Mars
      ],
    }));
    const legend = ui.h('div', { class: 'small mono ink2', style: { marginTop: '6px' } }, '\u25cf today\u2019s position   \u2501 path of the slower planets over the next ~14 months   \u2504 orbit (radius compressed by square root)');
    ctx.stage.append(ui.panel(
      { kicker: `Launch window: 400 days from ${p.date}`, title: `From Earth to ${ZH[p.target]}` },
      chart, legend,
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px', marginTop: '12px' } },
        ui.stat({ label: 'Target', value: ZH[p.target], sub: `orbit radius ${sma(p.target).toFixed(2)} AU` }),
        ui.stat({ label: 'Routes', value: `${p.routes.length}`, sub: p.routes.map((r) => label(ZH, r.via)).join(' · ') }))));

    // stage 1: estimate the best total delta-v
    const best = p.routes.reduce((a, b) => (b.dv < a.dv ? b : a));
    const est = await ctx.estimate({
      answer: best.dv, min: 3, max: 40, log: true, step: 0.1, initial: 12, unit: ' km/s', format: (v) => `${v.toFixed(1)} km/s`,
      scoring: 'log', scale: 0.35, attempts: 1,
      title: 'First, estimate: how much Δv does the cheapest route need?',
      prompt: 'For scale: escaping Earth from a 300 km low orbit takes about 3-4 km/s, and on arrival you still have to kill the speed relative to the target.',
    });
    ctx.log('estimate', est.guess, best.dv, est.score);

    // stage 2: rank the routes
    const items = p.routes.map((r) => {
      const ph = r.via ? Math.round(phaseDeg(el, r.via, jd0)) : null;
      return { id: r.via ?? 'direct', label: label(ZH, r.via), sub: r.via ? `Flyby of ${ZH[r.via]} \u00b7 today ${Math.abs(ph)}\u00b0 ${ph >= 0 ? 'ahead of' : 'behind'} Earth` : 'Direct transfer', value: r.dv };
    });
    const res = await ctx.order({
      items, direction: 'asc', attempts: 3,
      title: 'Rank by total Δv, cheapest first',
      prompt: 'Put the most fuel-efficient route (lowest Δv) on top. \u201cAhead/behind\u201d is the heliocentric longitude difference around the Sun.',
      format: (v) => `${v.toFixed(1)} km/s`,
    });

    const sorted = p.routes.slice().sort((a, b) => a.dv - b.dv);
    const rows = sorted.map((r) => ({
      route: label(ZH, r.via), dv: r.dv.toFixed(2), dep: r.vinf.toFixed(2), fb: r.flyby.length ? r.flyby[0].toFixed(2) : '—', arr: r.arr.toFixed(2),
      when: `${r.launch.slice(0, 7)} \u2192 ${r.arrive.slice(0, 7)} (${r.years} yr)`,
    }));
    const direct = p.routes.find((r) => !r.via);
    const why = sorted.slice(1).map((r) => `${label(ZH, r.via)} (+${(r.dv - best.dv).toFixed(1)}): ${culprit(r, best)}`);
    const score = blend(res.score, est.score);
    ctx.log('best', best.via ?? 'direct', best.dv, 'score', score);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.callout(best.via
        ? `The cheapest is the ${label(ZH, best.via)}: ${best.dv.toFixed(1)} km/s, ${(direct.dv - best.dv).toFixed(1)} km/s less than flying direct (${direct.dv.toFixed(1)}). On the way to ${ZH[p.target]}, ${ZH[best.via]} is well placed in the window: leave Earth ${best.launch}, fly by ${best.flybyDate}, arrive ${best.arrive} (${best.years} yr). Its gravity changes your heliocentric velocity, and what you save is your own engine fuel.`
        : `Flying direct is cheapest today: ${best.dv.toFixed(1)} km/s (leave ${best.launch}, arrive ${best.arrive}, ${best.years} yr). The flyby planets are out of position, or the turn they would have to provide is more than they can give, so a detour only costs more fuel.`, 'good'),
      ui.h('div', { class: 'small' }, `Your estimate was ${est.guess.toFixed(1)} km/s; the actual value is ${best.dv.toFixed(1)} km/s.`),
      ui.h('div', { class: 'small ink2' }, `Why the other routes cost more (versus the cheapest): ${why.join('; ')}.`),
      ui.table({
        columns: [{ key: 'route', label: 'Route' }, { key: 'dv', label: 'Δv', num: true }, { key: 'dep', label: 'Depart', num: true }, { key: 'fb', label: 'Flyby', num: true }, { key: 'arr', label: 'Arrive', num: true }, { key: 'when', label: 'Dates' }],
        rows,
      }),
      ui.h('div', { class: 'small muted' }, 'Units: km/s. Δv = total. Depart = low-orbit departure burn, Flyby = correction at the flyby, Arrive = relative speed on arrival.'));
    return { ...res, score, max: 100, summary: `${res.summary} \u00b7 estimate ${est.guess.toFixed(1)} km/s`, emoji: `${res.emoji}\nEstimate ${est.score >= 70 ? '🎯' : est.score >= 35 ? '👍' : '🙈'}` };
  },
};
