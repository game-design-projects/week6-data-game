// #28 Contract — read a real federal contract description, guess the dollar amount on a log scale.
export const BUCKETS = 8;

/** Pick `n` awards from distinct magnitude buckets so every day spans small and huge contracts. */
export function pickSet(awards, rng, n = 3) {
  const byB = Array.from({ length: BUCKETS }, () => []);
  awards.forEach((a, i) => byB[a.b].push(i));
  const bs = rng.sample([...Array(BUCKETS).keys()].filter((b) => byB[b].length), n);
  return bs.sort((x, y) => x - y).map((b) => rng.pick(byB[b]));
}

/** Within what factor was the guess? (symmetric, >= 1) */
export const factorOff = (guess, answer) => Math.exp(Math.abs(Math.log(guess / answer)));

const title = (s) => s.toLowerCase().replace(/(^|[\s(\/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());


const RULES = [
  [/MINIMUM GUARANTEE|\bBPA\b|IDIQ|BLANKET PURCHASE|INDEFINITE/i, '\u201cMinimum guarantee / BPA / IDIQ\u201d wording: the award is often just the guaranteed minimum or the first order under a framework, which says little about the contract\'s real scale.'],
  [/TASK ORDER|DELIVERY ORDER|\bTO\b \d|CALL (NO|ORDER)/i, 'A \u201ctask order / delivery order\u201d is one order under a big framework contract, usually one or two orders of magnitude smaller than the whole framework.'],
  [/CONSTRUCTION|REPAIR|RENOVAT|REPLACE|DESIGN[- ]BUILD|ROOF|HVAC|PAVEMENT|DREDG/i, 'Construction and repair: small fixes run tens of thousands to hundreds of thousands of dollars; whole buildings or major infrastructure reach the tens of millions.'],
  [/SOFTWARE|LICENSE|SUBSCRIPTION|MAINTENANCE|SUPPORT|RENEWAL/i, 'Software, maintenance and subscriptions: usually annual renewals, mostly in the hundreds of thousands to millions of dollars.'],
  [/AIRCRAFT|MISSILE|F-35|SHIP\b|SUBMARINE|ENGINE|RADAR|SATELLITE|SPACE|WEAPON|SYSTEM DEVELOPMENT/i, 'Aircraft, missiles, ships and space hardware: major-platform contracts easily run into the hundreds of millions; only parts or warranty orders are small.'],
  [/RESEARCH|STUDY|ANALYSIS|R&D|DEVELOPMENT/i, 'Research and analysis: government think-tank and science contracts mostly fall between a million and tens of millions of dollars.'],
  [/MEDICAL|LABORATORY|HEALTH|CLINIC|PHARMA|DRUG|HOSPITAL/i, 'Medical and lab work: orders from the VA and health agencies are mostly annual services, hundreds of thousands to a few million dollars.'],
  [/FUEL|FOOD|MEAL|JANITORIAL|CUSTODIAL|LAUNDRY|SECURITY GUARD|CATERING/i, 'Everyday logistics (fuel, food, cleaning, guards): a single order is usually tens to hundreds of thousands of dollars, re-bid on a schedule.'],
  [/TELECOM|ETHERNET|CIRCUIT|BANDWIDTH|NETWORK|CABLE/i, 'Telecom lines and network service: one line is a small monthly-rental contract, usually under tens of thousands of dollars.'],
];
const MAGNITUDE = ['a small purchase of $5K-$20K', 'a small order of $20K-$100K', 'a routine contract of $100K-$500K', 'a mid-size contract of $500K-$2M', 'a large contract of $2M-$10M', 'a major project of $10M-$50M', 'a flagship contract of $50M-$300M', 'a mega-contract of over $300M'];

/** Puzzle-specific teaching note: which description pattern fits this amount. Pure. */
export function lesson(a, guess) {
  const hits = RULES.filter(([re]) => re.test(a.desc)).slice(0, 2).map(([, t]) => t);
  const dir = guess > a.amt ? 'You guessed too high' : guess < a.amt ? 'You guessed too low' : 'Spot on';
  const parts = [`The amount is ${MAGNITUDE[a.b]}. ${dir}. Clues:`];
  if (hits.length) parts.push(...hits);
  else parts.push('The description itself carries no scale clue, so infer from agency + product category: ' + (a.ag === 'Department of Defense' ? 'Defense contracts span a huge range, with parts and major platforms differing by 1,000x or more.' : 'A single non-defense contract is mostly under a few million dollars.'));
  return parts.join(' ');
}

export default {
  meta: {
    num: 28,
    slug: 'contract',
    title: 'Contract',
    tagline: 'A real US federal contract description. Guess its dollar value, scored on a log scale.',
    category: 'money',
    data: 'snapshot',
    howTo: [
      'Each day brings 3 real federal contracts (USAspending public data), worth anywhere from a few thousand dollars to billions.',
      'Read the contract description, the buying agency, the product/service category and the contractor, then drag the slider (log scale) or type an amount.',
      'Being off by a factor matters more than being off by dollars: within 2x scores high, and 10x or more off scores almost nothing.',
      'Clues: \u201cMINIMUM GUARANTEE / BPA / IDIQ\u201d is often a guaranteed minimum or a framework; \u201cTASK ORDER\u201d is one order under a big framework; only equipment and R&D easily reach hundreds of millions.',
      'The three contracts come from three different size brackets, so every day mixes small, medium and large.',
    ],
    scoring: '100 points per contract, decaying with the log of the ratio between your guess and the real amount (4x off is about 37 points), 300 max over the 3 contracts.',
    sources: [
      { name: 'USAspending.gov API — spending_by_award', url: 'https://api.usaspending.gov/', note: 'Contract awards (award types A-D) for fiscal year 2025 (Oct 2024 to Sep 2025)' },
    ],
    dataNote: 'The amount is the contract\'s Award Amount (cumulative obligations when fetched, which may change with later modifications). The data is a snapshot sampled from 8 log-scale value brackets, about 55 per bracket, so it does not represent the true distribution of federal contracts (in reality small contracts are far more common). Contracts whose description states the amount were dropped, and non-defense agencies were over-sampled. The USAspending API allows cross-origin requests, but \u201ctoday\u2019s contracts\u201d cannot give every player the same fair puzzle, so nothing is fetched live.',
  },

  puzzle({ data, rng }) {
    return { ids: pickSet(data.awards, rng, 3) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const results = [];
    const awards = p.ids.map((i) => ctx.data.awards[i]);
    ctx.log('contracts', awards.map((a) => a.id));
    for (const [i, a] of awards.entries()) {
      const box = ui.h('div', { class: 'ds-stack' });
      ctx.stage.append(ui.panel({ kicker: `Contract ${i + 1} of ${awards.length}`, title: a.ag },
        ui.quote(a.desc),
        ui.kv([
          ['Contractor', a.rec],
          ['Product/service', a.psc ? title(a.psc) : '—'],
          ['Industry (NAICS)', a.naics ? title(a.naics) : '—'],
          ['Place of performance', a.st || '—'],
        ]), box));
      const r = await ctx.estimate({
        title: 'How many dollars is this contract worth?',
        answer: a.amt, min: 1000, max: 5e9, log: true, initial: 1e5, step: 1,
        unit: '', format: (v) => core.fmtMoney(v), scoring: 'log', scale: 0.6, container: box,
      });
      const f = factorOff(r.guess, a.amt);
      ctx.log('guess', { id: a.id, guess: r.guess, answer: a.amt, factor: f });
      results.push(r);
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [{ key: 'rec', label: 'Contractor' }, { key: 'amt', label: 'Actual', num: true }, { key: 'guess', label: 'Guess', num: true }, { key: 'x', label: 'Off by', num: true }],
        rows: awards.map((a, i) => ({ rec: a.rec.length > 13 ? `${a.rec.slice(0, 12)}\u2026` : a.rec, amt: core.fmtMoney(a.amt), guess: core.fmtMoney(results[i].guess), x: `${factorOff(results[i].guess, a.amt).toFixed(1)}×` })),
      }),
      ...awards.map((a, i) => ui.h('div', { class: 'small' }, ui.h('b', {}, `Contract ${i + 1}: `), lesson(a, results[i].guess))),
      ui.h('div', { class: 'small muted' }, 'Scoring uses the factor you were off by, not dollars: about 4x off leaves 37 points, and 10x or more is close to 0.'));
    return res;
  },
};
