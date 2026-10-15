// #16 Grade — three real violations from one NYC restaurant inspection; guess the score and the letter grade.

export const gradeOf = (score) => (score <= 13 ? 'A' : score <= 27 ? 'B' : 'C');

/** Scoring for the numeric guess: 100 at exact, decays with absolute error. */
export function scoreGuess(guess, answer, scale = 8) {
  return Math.round(100 * Math.exp(-Math.abs(guess - answer) / scale));
}

/** Typical points of one violation: [min, median, max, n] from inspections that cited only it. */
export const ptsOf = (pts, v) => pts?.[`${v.code}|${v.crit ? 'C' : 'G'}`] ?? null;

/** Sum of the per-violation medians — the "rule of thumb" total. */
export function typicalTotal(item, pts) {
  return item.v.reduce((s, v) => s + (ptsOf(pts, v)?.[1] ?? 0), 0);
}

/** Why the total came out the way it did, specific to this inspection. */
export function explain(item, pts) {
  const crit = item.v.filter((x) => x.crit).length;
  const typ = typicalTotal(item, pts);
  const diff = item.score - typ;
  const parts = [`${crit} of the 3 are Critical and ${3 - crit} General; adding their typical point values gives about ${typ}, versus the actual ${item.score}`];
  if (Math.abs(diff) <= 2) parts.push(': a close match, every violation was scored at its usual value.');
  else if (diff > 0) parts.push(`: ${diff} ${diff === 1 ? 'point' : 'points'} higher, so at least one violation was more severe or widespread than usual (points rise with severity, up to 28 for the worst tier).`);
  else parts.push(`: ${-diff} ${-diff === 1 ? 'point' : 'points'} lower, so the violations were milder and each was scored at the low end of its range.`);
  return parts.join('');
}

export default {
  meta: {
    num: 16,
    slug: 'grade',
    title: 'Grade',
    tagline: 'Three real violations from one NYC restaurant inspection. Guess the total points, then the letter grade in the window.',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      'A health inspector wrote up three violations at a New York restaurant (a plain-English summary plus the official wording). This inspection\'s result comes from these three alone.',
      'First estimate the total points; lower is better. Rule of thumb: a Critical violation costs about 5–10 points and a General one about 2–5, but a particularly serious one (say, no hand-washing facilities) can cost up to 28 on its own.',
      'Then pick the letter grade: 0–13 points is an A, 14–27 is a B, and 28 or more is a C.',
    ],
    scoring: 'Points guess: 100 × e^(−error/8), so each point off costs about 12; a correct grade earns 100. The two add up to a maximum of 200.',
    sources: [
      { name: 'NYC Open Data · DOHMH Restaurant Inspection Results', url: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j' },
      { name: 'NYC Health · Restaurant grading and scoring', url: 'https://www.nyc.gov/site/doh/business/food-operators/letter-grading-for-restaurants.page' },
    ],
    dataNote: 'Snapshot: inspections since 2024 with exactly 3 violations and an A/B/C grade, at most 7 restaurants per score, so B and C are over-represented (in reality most inspections are an A). Points for a single violation are not in the public data; the "typical" figure on the result page is the median total score of inspections that cited only that one violation. The plain-English summaries are written by hand; the official wording is shown beneath.',
  },

  puzzle({ data, pick }) {
    return { item: pick(data.items) };
  },

  async play(ctx, { item }) {
    const { ui } = ctx;
    const { pts, plain } = ctx.data;
    ctx.log('inspection', item.name, item.date, item.score, item.grade);
    ctx.stage.append(ui.panel({ kicker: `${item.boro} · ${item.cuisine}`, title: 'Three violations' },
      ui.h('div', { class: 'ds-stack' },
        item.v.map((x, i) => ui.h('div', { class: 'ds-stack', style: { gap: '4px' } },
          ui.h('div', { class: 'ds-row', style: { gap: '8px', alignItems: 'center' } },
            ui.badge(x.crit ? 'Critical' : 'General', x.crit ? 'bad' : undefined),
            ui.h('span', { class: 'mono small muted' }, `${i + 1} · ${x.code}`)),
          ui.h('div', plain?.[x.code] ?? x.text),
          plain?.[x.code] ? ui.h('div', { class: 'small muted' }, x.text) : null)))));

    const r1 = await ctx.estimate({
      answer: item.score, min: 0, max: 60, initial: 12, step: 1, log: false,
      title: 'How many points in total?', scoring: (g, a) => scoreGuess(g, a) / 100, format: (v) => `${Math.round(v)} pts`,
    });
    const gr = gradeOf(item.score);
    const labels = [['A', '0–13 pts'], ['B', '14–27 pts'], ['C', '28+ pts']];
    const r2 = await ctx.rounds({
      rounds: [{ prompt: 'Which grade goes in the window?', options: labels.map(([l, s]) => ({ label: l, sub: s })), correct: 'ABC'.indexOf(gr),
        explain: `Actual: ${item.score} points, grade ${gr}` }],
    });
    const r2n = { ...r2, score: r2.score ? 100 : 0, max: 100 };
    const res = ctx.combine([r1, r2n]);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['Restaurant', `${item.name} (${item.boro}, ${item.cuisine})`],
        ['Inspection date', item.date],
        ['Actual points', `${item.score} pts → grade ${gr}`],
      ]),
      ui.h('div', { class: 'ds-stack', style: { gap: '6px' } },
        item.v.map((x) => {
          const p = ptsOf(pts, x);
          return ui.h('div', { class: 'ds-row', style: { gap: '8px', alignItems: 'baseline' } },
            ui.badge(x.crit ? 'Critical' : 'General', x.crit ? 'bad' : undefined),
            ui.h('span', { class: 'small' }, `${plain?.[x.code] ?? x.code}`),
            p ? ui.h('span', { class: 'mono small muted' }, `Typical ${p[1]} pts (${p[0]}–${p[2]}, n=${p[3]})`) : null);
        })),
      ui.h('div', explain(item, pts)));
    return res;
  },
};
