// #40 Transit Dip — read the dip in a star's brightness, estimate the planet's radius.
// depth ≈ (Rp/Rs)²  →  Rp = Rs · √depth
const R_EARTH_PER_SUN = 0.009168; // R⊕ / R☉

/** Planet radius (R⊕) implied by transit depth (%) and stellar radius (R☉). */
export function radiusFromDepth(depthPct, rsSun) {
  return (Math.sqrt(depthPct / 100) * rsSun) / R_EARTH_PER_SUN;
}

/** Transit duration (hours) for a solar-density star on a circular orbit (illustrative). */
export function durationHours(perDays) {
  const aOverRs = 4.2 * Math.pow(perDays, 2 / 3);
  return Math.min((perDays * 24) / Math.PI / aOverRs, perDays * 24 * 0.4);
}

/** Relative flux at time t (hours from mid-transit): trapezoid with limb-darkened floor. */
export function flux(t, depth, dur, k) {
  const half = dur / 2, ing = Math.max(dur * Math.min(k, 0.5) / 2, dur * 0.03), a = Math.abs(t);
  if (a >= half) return 1;
  const f = a <= half - ing ? 1 : (half - a) / ing;
  const floor = 1 - 0.25 * (a / half) ** 2; // limb darkening: slightly deeper at centre
  return 1 - depth * f * (0.9 + 0.2 * floor / 1);
}

const fmtR = (v) => (v >= 10 ? v.toFixed(1) : v.toFixed(2));
const compare = (rp) => {
  if (rp < 0.8) return '比地球还小';
  if (rp < 1.25) return '和地球差不多大';
  if (rp < 2) return '超级地球（岩质大行星）';
  if (rp < 4) return '迷你海王星';
  if (rp < 8) return '海王星级别';
  if (rp < 14) return '木星级别的气态巨行星';
  return '膨胀的热木星';
};

export default {
  meta: {
    num: 40,
    slug: 'transit-dip',
    title: 'Transit Dip',
    tagline: '恒星亮度出现一道凹陷——行星从它面前经过了。读出凹陷深度，估算这颗行星有多大。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '图里是一颗真实恒星的亮度曲线（以正常亮度为 100%）。中间那道凹陷，就是行星挡住了一部分星光。',
      '关键公式：凹陷深度 ≈ (行星半径 ÷ 恒星半径)²。所以行星半径 ≈ 恒星半径 × √深度。',
      '题目给出恒星半径（太阳 = 1，太阳半径约等于 109 个地球半径）。估算行星半径，单位：地球半径。',
      '按对数计分：差 1.3 倍约扣到 37 分，差 2 倍约 5 分以下。',
    ],
    scoring: '100 × e^(−|ln(估计/真值)| / 0.3)。',
    sources: [
      { name: 'NASA Exoplanet Archive · PSCompPars', url: 'https://exoplanetarchive.ipac.caltech.edu/', note: '凌星深度、恒星半径、行星半径均为已发表的测量值' },
    ],
    dataNote: '曲线是用该行星真实的凌星深度与轨道周期绘制的示意图（含模拟噪声），不是原始望远镜测光数据。凌星时长按类太阳密度估算。',
  },

  puzzle({ data, pick }) {
    return { planet: pick(data.planets) };
  },

  async play(ctx, { planet: p }) {
    const { ui, core } = ctx;
    const depth = p.depth / 100;
    const dur = durationHours(p.per);
    const k = Math.sqrt(depth);
    const sigma = Math.min(depth * 0.12, 0.0008) + 0.00002;
    const pts = [];
    const span = dur * 2.2;
    for (let i = 0; i <= 160; i++) {
      const t = -span / 2 + (span * i) / 160;
      pts.push({ t, f: (flux(t, depth, dur, k) + ctx.rng.normal(0, sigma)) * 100 });
    }
    ctx.log('transit', p.name, 'depth%', p.depth, 'Rs', p.rs, 'Rp', p.rp);

    const chart = await ui.plot((Plot, c) => ({
      height: 260, marginLeft: 56,
      x: { label: '距凌星中点 (小时) →' },
      y: { label: '相对亮度 (%)', grid: true, domain: [100 - p.depth * 1.6 - 0.002, 100 + p.depth * 0.3 + 0.002], tickFormat: (v) => v.toFixed(p.depth < 0.1 ? 3 : 2) },
      marks: [
        Plot.ruleY([100], { stroke: c.muted, strokeDasharray: '3 4' }),
        Plot.dot(pts, { x: 't', y: 'f', r: 2.2, fill: c.accent, fillOpacity: 0.7 }),
        Plot.ruleY([100 - p.depth], { stroke: c.ink, strokeOpacity: 0.5 }),
        Plot.text([{ t: -span / 2, f: 100 - p.depth }], { x: 't', y: 'f', text: () => `深度 ${p.depth}%`, dy: -8, textAnchor: 'start', fill: c.ink }),
      ],
    }));

    ctx.stage.append(ui.panel({ kicker: '恒星亮度', title: `一颗半径 ${p.rs} R☉ 的恒星` },
      chart,
      ui.h('div', { class: 'ds-grid', style: { '--min': '120px', marginTop: '12px' } },
        ui.stat({ label: '凹陷深度', value: `${p.depth}%`, sub: `${Math.round(p.depth * 10000)} ppm` }),
        ui.stat({ label: '恒星半径', value: `${p.rs} R☉`, sub: `≈ ${Math.round(p.rs * 109.1)} R⊕` }),
        ui.stat({ label: '轨道周期', value: `${core.fmtNum(p.per)} 天` }))));

    const r = await ctx.estimate({
      title: '行星半径是多少？', prompt: '单位：地球半径 R⊕（木星 ≈ 11.2，海王星 ≈ 3.9）',
      answer: p.rp, min: 0.3, max: 30, log: true, step: 0.01, initial: 3,
      format: (v) => fmtR(v) + ' R⊕', scoring: 'log', scale: 0.3,
    });
    const calc = radiusFromDepth(p.depth, p.rs);
    r.detail = ui.kv([
      ['行星', `${p.name}（宿主星 ${p.star}${p.dist ? `，约 ${core.fmtNum(p.dist)} 光年` : ''}，${p.year} 年发现）`],
      ['公式', `√${p.depth}% × ${p.rs} R☉ × 109.1 ≈ ${fmtR(calc)} R⊕`],
      ['公布半径', `${fmtR(p.rp)} R⊕，${compare(p.rp)}`],
      ['线索', '深度每放大 4 倍，行星半径只放大 2 倍：半径是深度的平方根，别线性估算。']]);
    return r;
  },
};
