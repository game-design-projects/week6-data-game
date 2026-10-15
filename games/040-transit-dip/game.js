// #40 Transit Dip — read the dip in a star's brightness, estimate the planet's radius.
// depth ≈ (Rp/Rs)²  →  Rp = Rs · √depth
const R_EARTH_PER_SUN = 0.009168; // R⊕ / R☉

/** Planet radius (R⊕) implied by transit depth (%) and stellar radius (R☉). */
export function radiusFromDepth(depthPct, rsSun) {
  return (Math.sqrt(depthPct / 100) * rsSun) / R_EARTH_PER_SUN;
}

/** Relative flux (1 = out of transit) at t hours from mid-transit: trapezoid with limb-darkened floor.
 *  `dur` = published total duration (h), `k` = Rp/Rs, `b` = impact parameter (0 = central). Bottom centre = 1 - depth. */
export function flux(t, depth, dur, k, b = 0.3) {
  const half = dur / 2, a = Math.abs(t);
  if (a >= half) return 1;
  const ing = Math.min(Math.max((dur * k) / (1 - b * b) / 2, dur * 0.03), half * 0.9);
  const f = a <= half - ing ? 1 : (half - a) / ing;
  return 1 - depth * f * (1 - 0.2 * (a / half) ** 2);
}

/** Noise-free light curve (percent flux) with n+1 samples spanning 2.4 transit durations. */
export function curve(p, n = 160) {
  const depth = p.depth / 100, k = Math.sqrt(depth), span = p.dur * 2.4, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = -span / 2 + (span * i) / n;
    pts.push({ t, f: flux(t, depth, p.dur, k, p.b ?? 0.3) * 100 });
  }
  return { pts, span, sigma: (Math.min(depth * 0.1, 0.0008) + 0.00002) * 100 };
}

/** Log-score of a guess (0..100), same formula the estimate preset uses. */
export const logScore = (guess, truth, scale = SCALE) => 100 * Math.exp(-Math.abs(Math.log(guess / truth)) / scale);
const SCALE = 0.35;

const fmtR = (v) => (v >= 10 ? v.toFixed(1) : v.toFixed(2));
const compare = (rp) => {
  if (rp < 0.8) return 'smaller than Earth';
  if (rp < 1.25) return 'about Earth-sized';
  if (rp < 2) return 'a super-Earth (a large rocky planet)';
  if (rp < 4) return 'a mini-Neptune';
  if (rp < 8) return 'Neptune-sized';
  if (rp < 14) return 'a Jupiter-class gas giant';
  return 'a puffy hot Jupiter';
};

export default {
  meta: {
    num: 40,
    slug: 'transit-dip',
    title: 'Transit Dip',
    tagline: 'A star\'s brightness dips because a planet passed in front of it. Read the depth of the dip and estimate how big the planet is.',
    category: 'science',
    data: 'snapshot',
    howTo: [
      'The chart is the light curve of a real star (normal brightness = 100%). The dip in the middle is a planet blocking part of the starlight.',
      'The key formula: dip depth ≈ (planet radius ÷ star radius)². So planet radius ≈ star radius × √depth.',
      'The star\'s radius is given (Sun = 1; the Sun\'s radius is about 109 Earth radii). Estimate the planet\'s radius in Earth radii.',
      'Scored on a log scale: 1.4× off is about 37 points, 2× off about 14, and 3× or more earns almost nothing.',
    ],
    scoring: '100 × e^(−|ln(estimate / published radius)| / 0.35). Apply the formula correctly and you should score 85 or more.',
    sources: [
      { name: 'NASA Exoplanet Archive · PSCompPars', url: 'https://exoplanetarchive.ipac.caltech.edu/', note: 'transit depth, stellar radius and planet radius are all published measurements' },
    ],
    dataNote: 'Depth, transit duration, stellar radius and planet radius are all published measurements from the NASA Exoplanet Archive (the pool keeps only planets whose depth-derived radius is within 6% of the published one). The scatter plot is an illustrative curve drawn from them: the dip shape comes from the measured depth and duration, and the noise is simulated, not raw telescope photometry (MAST FITS files must be detrended and folded star by star, which a browser cannot do, and they have no CORS). NASA\'s TAP service has no CORS either, so it cannot be read live; this is a snapshot.',
  },

  puzzle({ data, pick }) {
    return { planet: pick(data.planets) };
  },

  async play(ctx, { planet: p }) {
    const { ui, core } = ctx;
    const { pts: base, span, sigma } = curve(p);
    const pts = base.map((q) => ({ t: q.t, f: q.f + ctx.rng.normal(0, sigma) }));
    ctx.log('transit', p.name, 'depth%', p.depth, 'Rs', p.rs, 'dur h', p.dur, 'Rp', p.rp);

    const chart = await ui.plot((Plot, c) => ({
      height: 260, marginLeft: 56,
      x: { label: 'Hours from mid-transit →', tickFormat: (v) => (p.dur < 3 ? v.toFixed(1) : v.toFixed(0)) },
      y: { label: 'Relative brightness (%)', grid: true, domain: [100 - p.depth * 1.6 - 0.002, 100 + p.depth * 0.3 + 0.002], tickFormat: (v) => v.toFixed(p.depth < 0.1 ? 3 : 2) },
      marks: [
        Plot.ruleY([100], { stroke: c.muted, strokeDasharray: '3 4' }),
        Plot.dot(pts, { x: 't', y: 'f', r: 2.2, fill: c.accent, fillOpacity: 0.7 }),
        Plot.ruleY([100 - p.depth], { stroke: c.ink, strokeOpacity: 0.5 }),
      ],
    }));

    ctx.stage.append(ui.panel({ kicker: 'Starlight', title: `A star with a radius of ${p.rs} R☉` },
      chart,
      ui.h('div', { class: 'ds-grid', style: { '--min': '120px', marginTop: '12px' } },
        ui.stat({ label: 'Dip depth', value: `${p.depth}%`, sub: `${Math.round(p.depth * 10000)} ppm` }),
        ui.stat({ label: 'Star radius', value: `${p.rs} R☉`, sub: `≈ ${Math.round(p.rs * 109.1)} R⊕` }),
        ui.stat({ label: 'Transit duration (hours)', value: p.dur.toFixed(1) }),
        ui.stat({ label: 'Orbital period (days)', value: p.per >= 100 ? core.fmtNum(Math.round(p.per)) : p.per.toFixed(2) }))));

    const r = await ctx.estimate({
      title: 'What is the planet\'s radius?', prompt: 'In Earth radii, R⊕ (Jupiter ≈ 11.2, Neptune ≈ 3.9)',
      answer: p.rp, min: 0.3, max: 30, log: true, step: 0.01, initial: 3,
      format: (v) => fmtR(v) + ' R⊕', scoring: 'log', scale: SCALE,
    });
    const calc = radiusFromDepth(p.depth, p.rs);
    const ratio = Math.sqrt(p.depth / 100);
    r.detail = ui.kv([
      ['Planet', `${p.name} (host star ${p.star}${p.dist ? `, about ${core.fmtNum(p.dist)} light-years away` : ''}, discovered in ${p.year})`],
      ['Formula', `√${p.depth}% = ${(ratio * 100).toFixed(1)}% (the planet\'s radius is ${(ratio * 100).toFixed(1)}% of the star\'s) × ${p.rs} R☉ × 109.1 ≈ ${fmtR(calc)} R⊕`],
      ['Published radius', `${fmtR(p.rp)} R⊕, ${compare(p.rp)}; ${Math.abs((calc / p.rp - 1) * 100).toFixed(1)}% from the formula (the gap comes from corrections such as limb darkening)`],
      ['Transit', `${p.dur.toFixed(1)} hours long, orbital period ${p.per} days${p.b != null ? `, impact parameter ${p.b} (closer to 1 means a grazing transit with more sloped dip edges)` : ''}`],
      ['Tip', `A ${p.depth}% dip looks shallow, but planet radius = star radius × √depth: a 4× deeper dip means only a 2× bigger planet, so do not estimate linearly.`]]);
    return r;
  },
};
