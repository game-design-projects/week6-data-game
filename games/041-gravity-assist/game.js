// #41 Gravity Assist — rank flyby routes by total delta-v, using real JPL Horizons planet positions.
export const label = (zh, via) => (via ? `经${zh[via]}借力` : '直飞');

/** route ids sorted from cheapest to most expensive */
export const rankRoutes = (routes) => routes.slice().sort((a, b) => a.dv - b.dv).map((r) => r.via ?? 'direct');

export default {
  meta: {
    num: 41,
    slug: 'gravity-assist',
    title: 'Gravity Assist',
    tagline: '看一张真实的太阳系俯视图，判断哪条借力路线最省燃料：直飞，还是绕金星、木星“拐一脚”？',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '图里是 JPL Horizons 给出的真实行星位置：彩色大点是发射窗口开启日，细线是接下来约一年半各行星走过的轨迹。',
      '从地球出发去目标行星，有直飞，也有先飞掠某颗行星借引力“弹”一下的路线。把这些路线按总 Δv（耗燃料）从小到大排好。',
      '看相位：目标和借力行星是否恰好在前方、能否顺路？木星这类大质量行星能把飞船甩得更快，但行星不在位置上就白绕。',
      '一共 3 次提交机会，每次会告诉你排对了几个位置。',
    ],
    scoring: '排序偏差越小得分越高；第一次全对 100 分，每多用一次扣分。',
    sources: [
      { name: 'NASA JPL Horizons System（行星日心状态向量）', url: 'https://ssd.jpl.nasa.gov/api/horizons.api', note: 'DE441 星历，黄道坐标，每 20 天一个采样点' },
      { name: 'Lambert 问题 + 圆锥曲线拼接', url: 'https://en.wikipedia.org/wiki/Lambert%27s_problem', note: '离线求每条路线的最小 Δv' },
    ],
    dataNote: '浏览器里没有可用的 CORS 星历接口，所以发射窗口来自离线下载的 Horizons 快照（2027–2062）。Δv = 从 300 km 低轨出发的点火 + 借力行星处的修正点火（若轨道转角够用则为 0）+ 到达目标时的相对速度（相当于刹停）；每条路线在约 16 个月的发射窗口、约 30 种飞行时间里搜索最小值。属于简化的拼接圆锥模型，不含深空机动与多圈轨道。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { id: p.id };
  },

  async play(ctx, pz) {
    const { ui, core } = ctx;
    const d = ctx.data;
    const p = d.puzzles.find((x) => x.id === pz.id);
    const ZH = d.zh;
    ctx.log('puzzle', p.id, p.target, p.start);
    const bodies = ['earth', p.target, ...new Set(p.routes.map((r) => r.via).filter(Boolean))];
    const reach = Math.max(...bodies.map((b) => d.radii[b])) * 1.12;

    // square-root radial scale so the inner planets are not crushed into the centre
    const sq = (r) => Math.sqrt(r / reach) * reach;
    const sqp = (x, y) => { const r = Math.hypot(x, y) || 1e-9; const k = sq(r) / r; return [x * k, y * k]; };
    const circle = (r) => Array.from({ length: 121 }, (_, i) => ({ x: sq(r) * Math.cos((i / 120) * 2 * Math.PI), y: sq(r) * Math.sin((i / 120) * 2 * Math.PI) }));
    const chart = await ui.plot((Plot, c) => {
      const trails = bodies.flatMap((b, bi) => p.trail.map((t, i) => ({ b: ZH[b], x: sqp(...t[b])[0], y: sqp(...t[b])[1], i })));
      const first = trails.filter((t) => t.i === 0);
      return {
        height: 380, aspectRatio: 1, axis: false, margin: 10,
        x: { domain: [-reach, reach] }, y: { domain: [-reach, reach] },
        color: { domain: bodies.map((b) => ZH[b]), range: c.series },
        marks: [
          ...bodies.map((b) => Plot.line(circle(d.radii[b]), { x: 'x', y: 'y', stroke: c.rule, strokeDasharray: '2 4' })),
          Plot.dot([{ x: 0, y: 0 }], { x: 'x', y: 'y', r: 7, fill: c.near, stroke: c.ink }),
          Plot.line(trails.filter((t) => d.radii[bodies.find((b) => ZH[b] === t.b)] > 1.3), { x: 'x', y: 'y', z: 'b', stroke: 'b', strokeWidth: 3, strokeOpacity: 0.55 }),
          Plot.dot(first, { x: 'x', y: 'y', fill: 'b', r: 8, stroke: c.paper, strokeWidth: 2 }),
          Plot.text(first, { x: 'x', y: 'y', text: 'b', fill: c.ink, dy: -15, fontWeight: 600, fontSize: 13 }),
        ],
      };
    });
    const legend = ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '6px' } },
      ui.h('span', '● 窗口开启日位置'), ui.h('span', '━ 慢行星之后约 16 个月的轨迹'), ui.h('span', '┄ 轨道（半径按平方根压缩）'));
    ctx.stage.append(ui.panel(
      { kicker: `发射窗口 ${p.start} → ${p.end}`, title: `从地球出发，去${ZH[p.target]}` },
      chart, legend,
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px', marginTop: '12px' } },
        ui.stat({ label: '目标', value: ZH[p.target], sub: `${d.radii[p.target].toFixed(2)} AU` }),
        ui.stat({ label: '候选路线', value: `${p.routes.length} 条`, sub: p.routes.map((r) => label(ZH, r.via)).join(' · ') }))));

    const items = p.routes.map((r) => ({ id: r.via ?? 'direct', label: label(ZH, r.via), sub: r.via ? `飞掠${ZH[r.via]}` : `直接转移`, value: r.dv }));
    const res = await ctx.order({
      items, direction: 'asc', attempts: 3,
      title: '按总 Δv 从省到费排序',
      prompt: '最上面是最省燃料（Δv 最小）的路线。',
      format: (v) => `${v.toFixed(1)} km/s`,
    });

    const rows = p.routes.slice().sort((a, b) => a.dv - b.dv).map((r) => ({
      route: label(ZH, r.via), dv: r.dv.toFixed(2), dep: r.vinf.toFixed(2), fb: r.flyby.length ? r.flyby[0].toFixed(2) : '—', arr: r.arr.toFixed(2),
      when: `${r.launch.slice(0, 7)} → ${r.arrive.slice(0, 7)}（${r.years} 年）`,
    }));
    const best = p.routes.reduce((a, b) => (b.dv < a.dv ? b : a));
    const direct = p.routes.find((r) => !r.via);
    ctx.log('best', best.via ?? 'direct', best.dv);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.callout(best.via
        ? `最省的是${label(ZH, best.via)}：${best.dv.toFixed(1)} km/s，比直飞（${direct.dv.toFixed(1)}）省 ${(direct.dv - best.dv).toFixed(1)} km/s。${ZH[best.via]}在这个窗口里恰好位于顺路的位置，借它的引力把飞船带到更高的日心速度，相当于免费加速。`
        : `这个窗口里直飞最省：${best.dv.toFixed(1)} km/s。借力行星的位置对不上，绕路只会多花燃料。`, 'good'),
      ui.table({
        columns: [{ key: 'route', label: '路线' }, { key: 'dv', label: '总 Δv', num: true }, { key: 'dep', label: '离地 v∞', num: true }, { key: 'fb', label: '借力修正', num: true }, { key: 'arr', label: '到达 v∞', num: true }, { key: 'when', label: '最佳时间' }],
        rows,
      }),
      ui.h('div', { class: 'small muted' }, '单位 km/s。总 Δv = 低轨出发点火 + 借力处修正 + 到达时的相对速度。'));
    return res;
  },
};
