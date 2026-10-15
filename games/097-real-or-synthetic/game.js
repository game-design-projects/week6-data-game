export const ROUNDS = 5;
export const TELLS = {
  ar1: 'A Gaussian model keeps the swings at an even size all the way through, with none of the “calm, then violent” clustering that real data shows.',
  shuffle: 'Shuffling keeps the mix of monthly ups and downs the same as the real series, but wipes out trend and momentum, so the curve looks like jittery noise.',
  block: 'Block bootstrapping keeps momentum within 6-month stretches, but the joins between blocks show unnatural kinks.',
  phase: 'Random phase keeps the overall rhythm of the ups and downs but turns the swings into a “perfect bell curve”, smoothing away the extreme spikes and crashes.',
};

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const steps = (x) => x.slice(1).map((v, i) => v - x[i]);
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? n / Math.sqrt(da * db) : 0;
}
/** Shape statistics of one 0–100 curve. jump = biggest one-month move (% of range); mom = lag-1 autocorrelation of
 *  monthly steps (momentum); clust = autocorrelation of |step| (volatility clustering). */
export function stats(v) {
  const d = steps(v), ad = d.map(Math.abs);
  return {
    jump: Math.max(...ad),
    mom: corr(d.slice(1), d.slice(0, -1)),
    clust: corr(ad.slice(1), ad.slice(0, -1)),
  };
}
const FEATS = {
  jump: { fmt: (x) => `${x.toFixed(1)}%`, up: 'The real curve has a bigger one-month jump; real markets often spike or crash suddenly, while algorithm-made swings are gentler', down: 'The real curve\'s biggest one-month jump is actually smaller; the fakes contain more abrupt jumps', name: 'Biggest one-month move (share of the full range)' },
  mom: { fmt: (x) => x.toFixed(2), up: 'The real curve has more momentum: after a rise it tends to keep rising, forming long runs up and down, while the fakes zigzag back and forth', down: 'The real curve\'s monthly moves are looser; the fakes actually show more continuous trend runs', name: 'Momentum (correlation between consecutive monthly moves)' },
  clust: { fmt: (x) => x.toFixed(2), up: 'The real curve\'s volatility clusters: violent months bunch together, with distinct calm and turbulent periods, while the fakes swing evenly', down: 'In this puzzle the real curve shows little volatility clustering, and the fakes actually clump more', name: 'Volatility clustering (correlation between consecutive move sizes)' },
};
/** Which statistic separates the real curve from the decoys most, and a sentence about this particular puzzle. */
export function giveaway(pz) {
  const all = [pz.real, ...pz.decoys.map((d) => d.v)].map(stats);
  let best = null;
  for (const k of Object.keys(FEATS)) {
    const vals = all.map((s) => s[k]), m = mean(vals), sd = Math.sqrt(mean(vals.map((v) => (v - m) ** 2))) || 1e-9;
    const dev = (vals[0] - mean(vals.slice(1))) / sd;
    if (!best || Math.abs(dev) > Math.abs(best.dev)) best = { k, dev, real: vals[0], fakes: vals.slice(1) };
  }
  const f = FEATS[best.k];
  return {
    ...best,
    text: `${f.name}: real ${f.fmt(best.real)}, the three fakes ${best.fakes.map(f.fmt).join(' / ')}. ${best.dev > 0 ? f.up : f.down}.`,
  };
}

/** Deterministic option order: real curve lands in a seeded slot. */
export function layout(pz, rng) {
  const items = [{ real: true, v: pz.real }, ...pz.decoys.map((d) => ({ real: false, v: d.v, m: d.m }))];
  const order = rng.shuffle(items);
  return { order, correct: order.findIndex((x) => x.real) };
}
const ymAdd = (ym, k) => { const [y, m] = ym.split('-').map(Number), t = y * 12 + m - 1 + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };

export default {
  meta: {
    num: 97,
    slug: 'real-or-synthetic',
    title: 'Real or Synthetic',
    tagline: 'Four trend lines, three forged by an algorithm from the real thing\'s statistics. Spot the genuine one.',
    category: 'literacy',
    data: 'computed',
    howTo: [
      '5 puzzles a day. Each shows four unlabeled 72-month trend lines, all scaled to the same height range, drawn from oil, stocks, currencies, temperature and more.',
      'One is real economic or climate data. The other three are forged by an algorithm from its statistics: an AR(1) Gaussian model, shuffled steps, block bootstrapping or random phase.',
      'Tap the one you think is real. Watch for what real data often has: volatility clustering, sudden big jumps and persistent trends.',
      'After you answer you see the real series\' name and period, the method behind each fake, and, using this puzzle\'s actual numbers, where the giveaway was.',
    ],
    scoring: '1 point for each correct answer, 5 in all. Pure guessing averages only 1.25, so scoring 3 or more regularly means you can spot the quirks of real data.',
    sources: [
      { name: 'NOAA / NASA global monthly temperature anomaly (datasets/global-temp)', url: 'https://github.com/datasets/global-temp' },
      { name: 'NOAA GML Mauna Loa CO₂ (datasets/co2-ppm)', url: 'https://github.com/datasets/co2-ppm' },
      { name: 'EIA Brent and WTI crude oil prices (datasets/oil-prices)', url: 'https://github.com/datasets/oil-prices' },
      { name: 'EIA Henry Hub natural gas price (datasets/natural-gas)', url: 'https://github.com/datasets/natural-gas' },
      { name: 'Shiller S&P 500 index, dividends, earnings (datasets/s-and-p-500)', url: 'https://github.com/datasets/s-and-p-500' },
      { name: 'US CPI (datasets/cpi-us)', url: 'https://github.com/datasets/cpi-us' },
      { name: 'Gold prices (datasets/gold-prices)', url: 'https://github.com/datasets/gold-prices' },
      { name: 'US 10-year Treasury yield (datasets/bond-yields-us-10y)', url: 'https://github.com/datasets/bond-yields-us-10y' },
      { name: 'Federal Reserve H.10 exchange rates (datasets/exchange-rates)', url: 'https://github.com/datasets/exchange-rates' },
    ],
    dataNote: 'The real series come from the public GitHub mirrors above (the datasets organization): monthly NOAA, NASA, EIA, Shiller and Federal Reserve data. Each puzzle takes one 72-month window (price series are log-transformed first). The fakes are generated offline in build/: starting from the real window\'s monthly changes, four surrogate-data methods (AR(1), shuffle, block bootstrap, random phase) rebuild a trend, so the fakes are computed, not real data. The FRED CSV endpoint suggested in the original idea has no cross-origin permission and cannot be read from a browser, and this puzzle does not need same-day data, so an offline snapshot is used. Windows that were too smooth and easy to spot at a glance (parts of CPI and gold) were dropped.',
  },

  puzzle({ data, day }) {
    // data.puzzles is pre-ordered at build time so any 5 consecutive entries come from 5 different series
    const n = data.puzzles.length, ids = [];
    for (let i = 0; i < ROUNDS; i++) ids.push(data.puzzles[((((day - 1) * ROUNDS + i) % n) + n) % n].id);
    return { ids };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const byId = new Map(ctx.data.puzzles.map((x) => [x.id, x]));
    const pzs = p.ids.map((i) => byId.get(i));
    const lays = pzs.map((pz) => layout(pz, ctx.rng));
    const rounds = [];
    for (let i = 0; i < pzs.length; i++) {
      const pz = pzs[i], lay = lays[i], meta = ctx.data.series[pz.s];
      const options = [];
      for (let k = 0; k < 4; k++) {
        const body = await ui.plot((Plot, c) => ({
          height: 110, width: 150, margin: 4,
          x: { axis: null }, y: { axis: null, domain: [-3, 103] },
          marks: [Plot.lineY(lay.order[k].v, { stroke: c.ink, strokeWidth: 2 })],
        }), { axis: false });
        options.push({ label: 'ABCD'[k], body });
      }
      const letter = 'ABCD'[lay.correct];
      const list = lay.order.map((o, k) => `${'ABCD'[k]} ${o.real ? 'real' : ctx.data.methods[o.m]}`).join(' · ');
      rounds.push({
        prompt: 'Which line is the real data?',
        options, correct: lay.correct,
        explain: ui.h('span', {}, `The real one is ${letter}: ${meta.name}, ${pz.from} to ${pz.to}.`, ui.h('br'), list),
      });
      ctx.log('round', i + 1, pz.s, pz.from, 'real =', letter);
    }
    const res = await ctx.rounds({ rounds, minWidth: 150 });
    const blocks = [];
    for (let i = 0; i < pzs.length; i++) {
      const pz = pzs[i], meta = ctx.data.series[pz.s], g = giveaway(pz);
      const ms = [...new Set(pz.decoys.map((d) => d.m))];
      const chart = await ui.plot((Plot, c) => ({
        height: 150, marginLeft: 8, marginBottom: 22,
        x: { label: null, ticks: 4, tickFormat: (k) => ymAdd(pz.from, Math.round(k)) },
        y: { axis: null, domain: [-3, 103] },
        marks: [
          ...pz.decoys.map((d, j) => Plot.lineY(d.v, { stroke: c.series[(j + 1) % c.series.length], strokeOpacity: 0.55, strokeWidth: 1.2 })),
          Plot.lineY(pz.real, { stroke: c.accent, strokeWidth: 2.6 }),
        ],
      }));
      blocks.push(ui.panel({ kicker: `Puzzle ${i + 1}`, title: meta.name, plain: true },
        ui.kv([
          ['Data', `${pz.from} to ${pz.to} · ${meta.unit} · source: ${meta.src}`],
          ['The giveaway', g.text],
          ['Forgery methods', ms.map((m) => `${ctx.data.methods[m]}: ${TELLS[m]}`).join(' ')],
        ]),
        chart,
        ui.h('div', { class: 'ds-muted', style: { fontSize: '12px' } }, 'Thick line is the real data; thin lines are the three fakes (all scaled to 0–100).')));
    }
    res.detail = ui.h('div', { class: 'ds-stack' }, ...blocks,
      ui.callout('General tip: real data often has volatility clustering (calm spells followed by violent ones), sudden big jumps and persistent trends; fakes tend to swing too evenly or jitter too much.', 'good'));
    return res;
  },
};
