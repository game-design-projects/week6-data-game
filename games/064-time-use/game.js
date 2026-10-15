// #64 Time Use — guess how many minutes a day a group of Americans spends on an activity (BLS ATUS).
import { ACT, SLEEP } from './acts.js';

export { ACT };
const AGE = { '000': 'Ages 15 and over', 103: 'Ages 15–24', '031': 'Ages 25–34', '038': 'Ages 35–44', '042': 'Ages 45–54', '049': 'Ages 55–64', '065': 'Ages 65 and over' };
const SEX = ['Men and women', 'Men', 'Women'];
export const MIN_MEAN = 5; // activities averaging < 5 min/day are too small to estimate fairly
export const SCALE = 0.3; // log10 error scale: 2x off ~ 37 pts
export const ageLabel = (a) => AGE[a];
export const sexLabel = (s) => SEX[s];
export const fmtHM = (m) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`);
const fmtShort = (m) => (m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`);
export const eligible = (g) => Object.keys(g.v).filter((k) => ACT[k] && g.v[k][0] >= MIN_MEAN);
export const whoLabel = (g) => `US · ${g.y} · ${SEX[g.s]} · ${AGE[g.a]}`;
export const findGroup = (groups, p) => groups.find((x) => x.y === p.y && x.s === p.s && x.a === p.a);

/** Why the number is what it is: participation × time-per-doer, versus all US adults of the same year. */
export function explain(cell, base) {
  const [mean, rate, doer] = cell;
  let t;
  if (rate < 15) t = `Only ${rate}% of people did this on a given day. Those who did averaged ${fmtHM(doer)}, which spread over everyone is just ${fmtHM(mean)}.`;
  else if (rate >= 85) t = `${rate}% of people did it that day, so the all-people average (${fmtHM(mean)}) and the average among those who did (${fmtHM(doer)}) are almost the same.`;
  else t = `${rate}% of people did it that day, averaging ${fmtHM(doer)}; counting those who didn't as 0, the all-people average is ${fmtHM(mean)}.`;
  if (base && base !== cell) {
    const r = mean / base[0];
    if (r >= 1.25) t += ` About ${Math.round((r - 1) * 100)}% more than all Americans 15 and over that year (${fmtHM(base[0])}).`;
    else if (r <= 0.8) t += ` About ${Math.round((1 - r) * 100)}% less than all Americans 15 and over that year (${fmtHM(base[0])}).`;
  }
  return t;
}

export default {
  meta: {
    num: 64,
    slug: 'time-use',
    title: 'Time Use',
    tagline: 'How many minutes a day does a group of Americans spend on an activity? Estimate three, using their sleep and participation rate as clues.',
    category: 'society',
    data: 'snapshot',
    howTo: [
      'Today you get a group of Americans (year, sex, age range) and three everyday activities.',
      'Estimate how many minutes a day that group spends on each one. This is the average over all people and all days, so people who did not do the activity that day count as 0 minutes.',
      'Clues: the group\'s average sleep, and the share of people who did the activity that day. A low share drags the average way down.',
    ],
    scoring: 'Each answer is scored by how many times off you are (log scale): 1.4x off is about 61 points, 2x off about 37, 10x off about 4. The three are averaged.',
    sources: [
      { name: 'BLS American Time Use Survey (ATUS)', url: 'https://www.bls.gov/tus/', note: 'The Bureau of Labor Statistics time-diary survey, annual data for 2003–2025' },
      { name: 'BLS ATUS time series files (tu.series / tu.data)', url: 'https://download.bls.gov/pub/time.series/tu/', note: 'The raw files this game reads directly' },
    ],
    dataNote: 'Snapshot data: BLS publishes the previous year\'s results around June and does not update daily, so this is not live data. Minutes are the official average hours per day times 60, rounded; participation rate is the official share of the population who did the activity on the diary day. In 2020 the survey was suspended for several months because of the pandemic.',
  },

  puzzle({ data, pick, rng }) {
    const g = pick(data.groups);
    return { y: g.y, s: g.s, a: g.a, acts: rng.sample(eligible(g), 3) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const g = findGroup(ctx.data.groups, p);
    const base = ctx.data.groups.find((x) => x.y === p.y && x.s === 0 && x.a === '000');
    ctx.log('group', p);
    const who = whoLabel(g);
    ctx.stage.append(ui.panel({ kicker: 'Today\'s group', title: who },
      ui.row(
        ui.stat({ label: 'Average sleep per day', value: fmtHM(g.v[SLEEP][0]), sub: '1,440 minutes in a day' }),
        ui.stat({ label: 'To estimate', value: '3 activities', sub: 'in minutes, log slider' })),
      p.y === 2020 ? ui.callout('In 2020 the survey was suspended for several months during the pandemic; the figures are still the official published values.') : null));
    const results = [];
    for (const ac of p.acts) {
      const [name, gloss] = ACT[ac];
      const [mean, rate] = g.v[ac];
      ctx.log('ask', ac, mean, rate);
      results.push(await ctx.estimate({
        title: `${name}: how many minutes a day on average?`,
        prompt: `${who}. “${name}” covers ${gloss}. In this group, ${rate}% did it that day.`,
        answer: mean, min: 1, max: 720, log: true, step: 1, initial: 30,
        format: (v) => fmtHM(Math.round(v)), scoring: 'log', scale: SCALE,
      }));
    }
    const out = ctx.combine(results);
    out.detail = ui.stack(
      ui.callout(`${who}. The average counts people who did not do the activity as 0 minutes: low-participation activities look short, and only high-participation ones come close to the time those who do them spend.`),
      ui.table({
        columns: [{ key: 'n', label: 'Activity' }, { key: 'm', label: 'Everyone', num: true }, { key: 'r', label: 'Did it', num: true }, { key: 'd', label: 'Doers', num: true }],
        rows: p.acts.map((ac) => ({ n: ACT[ac][0], m: fmtShort(g.v[ac][0]), r: `${g.v[ac][1]}%`, d: fmtShort(g.v[ac][2]) })),
      }),
      ...p.acts.map((ac) => ui.quote(`${ACT[ac][0]}: ${explain(g.v[ac], base?.v[ac])}`)));
    return out;
  },
};
