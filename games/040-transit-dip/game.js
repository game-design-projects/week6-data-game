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
      '按对数计分：差 1.4 倍约 37 分，差 2 倍约 14 分，差 3 倍以上基本拿不到分。',
    ],
    scoring: '100 × e^(−|ln(估计/公布半径)| / 0.35)；套公式算对，能拿 85 分以上。',
    sources: [
      { name: 'NASA Exoplanet Archive · PSCompPars', url: 'https://exoplanetarchive.ipac.caltech.edu/', note: '凌星深度、恒星半径、行星半径均为已发表的测量值' },
    ],
    dataNote: '深度、凌星时长、恒星半径、行星半径均为 NASA Exoplanet Archive 上已发表的实测值（题库只保留深度推算半径与公布半径相差 6% 以内的行星）。图中的散点是据此绘制的示意曲线：凹陷形状由实测深度与时长画出，噪声为模拟，不是原始望远镜测光（MAST 的 FITS 文件需逐星去趋势、折叠，浏览器端做不到，且无 CORS）。NASA 的 TAP 接口无 CORS，无法实时读取，所以是快照。',
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
      x: { label: '距凌星中点 (小时) →', tickFormat: (v) => (p.dur < 3 ? v.toFixed(1) : v.toFixed(0)) },
      y: { label: '相对亮度 (%)', grid: true, domain: [100 - p.depth * 1.6 - 0.002, 100 + p.depth * 0.3 + 0.002], tickFormat: (v) => v.toFixed(p.depth < 0.1 ? 3 : 2) },
      marks: [
        Plot.ruleY([100], { stroke: c.muted, strokeDasharray: '3 4' }),
        Plot.dot(pts, { x: 't', y: 'f', r: 2.2, fill: c.accent, fillOpacity: 0.7 }),
        Plot.ruleY([100 - p.depth], { stroke: c.ink, strokeOpacity: 0.5 }),
      ],
    }));

    ctx.stage.append(ui.panel({ kicker: '恒星亮度', title: `一颗半径 ${p.rs} R☉ 的恒星` },
      chart,
      ui.h('div', { class: 'ds-grid', style: { '--min': '120px', marginTop: '12px' } },
        ui.stat({ label: '凹陷深度', value: `${p.depth}%`, sub: `${Math.round(p.depth * 10000)} ppm` }),
        ui.stat({ label: '恒星半径', value: `${p.rs} R☉`, sub: `≈ ${Math.round(p.rs * 109.1)} R⊕` }),
        ui.stat({ label: '凌星时长（小时）', value: p.dur.toFixed(1) }),
        ui.stat({ label: '轨道周期（天）', value: p.per >= 100 ? core.fmtNum(Math.round(p.per)) : p.per.toFixed(2) }))));

    const r = await ctx.estimate({
      title: '行星半径是多少？', prompt: '单位：地球半径 R⊕（木星 ≈ 11.2，海王星 ≈ 3.9）',
      answer: p.rp, min: 0.3, max: 30, log: true, step: 0.01, initial: 3,
      format: (v) => fmtR(v) + ' R⊕', scoring: 'log', scale: SCALE,
    });
    const calc = radiusFromDepth(p.depth, p.rs);
    const ratio = Math.sqrt(p.depth / 100);
    r.detail = ui.kv([
      ['行星', `${p.name}（宿主星 ${p.star}${p.dist ? `，约 ${core.fmtNum(p.dist)} 光年` : ''}，${p.year} 年发现）`],
      ['公式', `√${p.depth}% = ${(ratio * 100).toFixed(1)}%（行星半径是恒星的 ${(ratio * 100).toFixed(1)}%）× ${p.rs} R☉ × 109.1 ≈ ${fmtR(calc)} R⊕`],
      ['公布半径', `${fmtR(p.rp)} R⊕，${compare(p.rp)}；与公式相差 ${Math.abs((calc / p.rp - 1) * 100).toFixed(1)}%（差异来自边缘变暗等修正）`],
      ['凌星时长', `${p.dur.toFixed(1)} 小时，轨道周期 ${p.per} 天${p.b != null ? `，碰撞参数 ${p.b}（越接近 1 越擦边，凹陷边缘越斜）` : ''}`],
      ['线索', `${p.depth}% 的凹陷看着很浅，但行星半径 = 恒星 × √深度：深度每放大 4 倍，半径只放大 2 倍，别线性估算。`]]);
    return r;
  },
};
