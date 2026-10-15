// #41 Gravity Assist — today's real planet positions (JPL Keplerian ephemeris) → rank flyby routes by total delta-v.
import { buildPuzzle, TARGETS, jdOf, position, phaseDeg, AU, STEP, NDEP, DEP_STRIDE } from './astro.js';

export const label = (zh, via) => (via ? `经${zh[via]}借力` : '直飞');
/** route ids sorted from cheapest to most expensive */
export const rankRoutes = (routes) => routes.slice().sort((a, b) => a.dv - b.dv).map((r) => r.via ?? 'direct');
/** final score: 70 % ranking, 30 % the Δv estimate */
export const blend = (order, est) => Math.round(0.7 * order + 0.3 * est);
/** which term makes `r` cost more than the best route `b`: [text, extra km/s] */
export function culprit(r, b) {
  const parts = [
    ['离地速度要得更高', r.vinf - b.vinf], // positive = worse (vinf proxies the departure burn)
    ['借力处还要额外点火修正', r.flyby.reduce((s, x) => s + x, 0) - b.flyby.reduce((s, x) => s + x, 0)],
    ['到达时相对目标太快、刹车代价大', r.arr - b.arr],
  ];
  parts.sort((x, y) => y[1] - x[1]);
  return parts[0][1] > 0.15 ? parts[0][0] : '三项都略高';
}

export default {
  meta: {
    num: 41,
    slug: 'gravity-assist',
    title: 'Gravity Assist',
    tagline: '今天各大行星的真实位置摆在眼前：从地球出发，直飞还是借某颗行星的引力“弹”一下，哪条路线最省燃料？',
    category: 'science',
    data: 'computed',
    howTo: [
      '图里是今天（用 JPL 轨道根数算出的）各行星真实位置：彩色大点是今天的位置，细线是之后约 14 个月慢行星走过的轨迹。发射窗口从今天起开放 400 天。',
      '先估算：最省燃料那条路线的总 Δv 大概是多少 km/s？',
      '再排序：把 4 条路线（1 条直飞 + 3 条各借一颗行星的引力）按总 Δv 从小到大排好，一共 3 次提交机会，每次告诉你对了几个位置。',
      '看相位：借力行星是不是正好在去目标的路上？飞掠木星这类大质量行星能大幅加速，但行星不在位置上，绕路只会多花燃料。',
    ],
    scoring: '总分 100：排序占 70（第 1 次排对 70，第 2 次约 47，第 3 次约 23，没排对按位置给少量分），Δv 估算占 30（倍数误差越小越高）。',
    sources: [
      { name: 'NASA JPL「Approximate Positions of the Planets」（开普勒轨道根数，1800–2050 年）', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', note: '本游戏用它在浏览器里算出每天的行星位置与速度' },
      { name: 'NASA JPL Horizons System', url: 'https://ssd.jpl.nasa.gov/api/horizons.api', note: '仅用于离线校验：90 个检查点上轨道根数与 DE441 星历的位置偏差都在 0.05 AU 内' },
      { name: 'Lambert 问题 + 圆锥曲线拼接', url: 'https://en.wikipedia.org/wiki/Lambert%27s_problem', note: '求每条路线的最小 Δv' },
    ],
    dataNote: 'Horizons 接口没有 CORS（浏览器无法直接调用），所以游戏用 JPL 公布的开普勒轨道根数在本地计算当天行星位置，meta.data 为“计算”而非“实时”。Δv 为简化的拼接圆锥模型：从 300 km 低轨出发的点火 + 借力行星处的修正点火（若轨道转角够用则为 0）+ 到达目标时的相对速度（相当于刹停，不含入轨）。每条路线在 400 天发射窗口（每 40 天一个出发点）、约 10 种飞行时间的网格里搜索最小值，总飞行时间不超过 14 年，只考虑零圈兰伯特弧和单次借力，不含深空机动。目标行星每天轮换；若某个目标的四条路线 Δv 太接近（相差不足 4%），当天会换下一个目标。',
  },

  puzzle({ data, date, pick }) {
    const p = buildPuzzle(data.elements, date, pick(TARGETS));
    return { date: p.date, target: p.target, routes: p.routes };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const d = ctx.data, el = d.elements, ZH = d.zh;
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
    const legend = ui.h('div', { class: 'small mono ink2', style: { marginTop: '6px' } }, '● 今天的位置　━ 之后约 14 个月慢行星的轨迹　┄ 轨道（半径按平方根压缩）');
    ctx.stage.append(ui.panel(
      { kicker: `发射窗口 ${p.date} 起 400 天`, title: `从地球出发，去${ZH[p.target]}` },
      chart, legend,
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px', marginTop: '12px' } },
        ui.stat({ label: '目标', value: ZH[p.target], sub: `轨道半径 ${sma(p.target).toFixed(2)} AU` }),
        ui.stat({ label: '候选路线', value: `${p.routes.length} 条`, sub: p.routes.map((r) => label(ZH, r.via)).join(' · ') }))));

    // stage 1: estimate the best total delta-v
    const best = p.routes.reduce((a, b) => (b.dv < a.dv ? b : a));
    const est = await ctx.estimate({
      answer: best.dv, min: 3, max: 40, log: true, step: 0.1, initial: 12, unit: ' km/s', format: (v) => `${v.toFixed(1)} km/s`,
      scoring: 'log', scale: 0.35, attempts: 1,
      title: '先估一估：最省的路线要多少 Δv？',
      prompt: '参考：从 300 km 低轨冲出地球引力就要约 3–4 km/s；到达时还得把相对目标的速度刹掉。',
    });
    ctx.log('estimate', est.guess, best.dv, est.score);

    // stage 2: rank the routes
    const items = p.routes.map((r) => {
      const ph = r.via ? Math.round(phaseDeg(el, r.via, jd0)) : null;
      return { id: r.via ?? 'direct', label: label(ZH, r.via), sub: r.via ? `飞掠${ZH[r.via]} · 今天在地球${ph >= 0 ? '前方' : '后方'} ${Math.abs(ph)}°` : '直接转移', value: r.dv };
    });
    const res = await ctx.order({
      items, direction: 'asc', attempts: 3,
      title: '按总 Δv 从省到费排序',
      prompt: '最上面是最省燃料（Δv 最小）的路线。“前方/后方”指绕太阳的日心经度差。',
      format: (v) => `${v.toFixed(1)} km/s`,
    });

    const sorted = p.routes.slice().sort((a, b) => a.dv - b.dv);
    const rows = sorted.map((r) => ({
      route: label(ZH, r.via), dv: r.dv.toFixed(2), dep: r.vinf.toFixed(2), fb: r.flyby.length ? r.flyby[0].toFixed(2) : '—', arr: r.arr.toFixed(2),
      when: `${r.launch.slice(0, 7)} → ${r.arrive.slice(0, 7)}（${r.years} 年）`,
    }));
    const direct = p.routes.find((r) => !r.via);
    const why = sorted.slice(1).map((r) => `${label(ZH, r.via)}（+${(r.dv - best.dv).toFixed(1)}）：${culprit(r, best)}`);
    const score = blend(res.score, est.score);
    ctx.log('best', best.via ?? 'direct', best.dv, 'score', score);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.callout(best.via
        ? `最省的是${label(ZH, best.via)}：${best.dv.toFixed(1)} km/s，比直飞（${direct.dv.toFixed(1)}）省 ${(direct.dv - best.dv).toFixed(1)} km/s。去${ZH[p.target]}的路上，${ZH[best.via]}在窗口里恰好可借：${best.launch} 离地，${best.flybyDate} 飞掠，${best.arrive} 到达（${best.years} 年），借它的引力改变日心速度，省下的是自己点火的燃料。`
        : `今天直飞最省：${best.dv.toFixed(1)} km/s（${best.launch} 离地，${best.arrive} 到达，${best.years} 年）。借力行星的位置对不上，或要求的转向超过它能提供的，绕路只会多花燃料。`, 'good'),
      ui.h('div', { class: 'small' }, `你的估算 ${est.guess.toFixed(1)} km/s，实际 ${best.dv.toFixed(1)} km/s。`),
      ui.h('div', { class: 'small ink2' }, `其他路线为什么更贵（相对最省路线）：${why.join('；')}。`),
      ui.table({
        columns: [{ key: 'route', label: '路线' }, { key: 'dv', label: '总 Δv', num: true }, { key: 'dep', label: '离地 v∞', num: true }, { key: 'fb', label: '借力修正', num: true }, { key: 'arr', label: '到达 v∞', num: true }, { key: 'when', label: '最佳时间' }],
        rows,
      }),
      ui.h('div', { class: 'small muted' }, '单位 km/s。总 Δv = 低轨出发点火 + 借力处修正 + 到达时的相对速度。'));
    return { ...res, score, max: 100, summary: `${res.summary} · 估算 ${est.guess.toFixed(1)} km/s`, emoji: `${res.emoji}\n估算 ${est.score >= 70 ? '🎯' : est.score >= 35 ? '👍' : '🙈'}` };
  },
};
