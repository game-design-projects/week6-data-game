// #66 Splits — a real Boston Marathon runner's first 25K; predict the finish time.
export const KM = [5, 10, 15, 20, 25];
export const hms = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
export const pace = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
/** seconds per km of each 5K segment */
export const segPaces = (sp) => sp.map((t, i) => (t - (sp[i - 1] ?? 0)) / 5);
/** finish time (s) if the pace of the 25K mark were held for the rest of the 42.195K */
export const evenProjection = (t25) => t25 * (42.195 / 25);
/** slowdown of the last 17.2K vs the first 25K, in % (positive = faded) */
export const fadePct = (t25, fin) => ((fin - t25) / (t25 * (17.195 / 25)) - 1) * 100;
const YEAR = { 2015: '2015 年：低温、逆风、有雨', 2016: '2016 年：晴天高温（约 21℃），公认的“热浪年”', 2017: '2017 年：偏热（约 22℃），无云' };

export default {
  meta: {
    num: 66,
    slug: 'splits',
    title: 'Splits',
    tagline: '一位真实马拉松选手前 25 公里的分段成绩，预测他的完赛时间。看出谁会掉速，就是你的技巧。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '图里是波士顿马拉松（2015–2017）某位真实选手每 5 公里的配速（每公里用时），只给到 25 公里。',
      '最省事的做法是“匀速外推”：按 25K 的平均配速（图中虚线）跑完全程。但大多数人后程会掉速。',
      '结合年龄、性别、前半程是否越跑越快、当年天气，拖动滑块估计完赛时间。',
      '误差越小分数越高：偏差 4% 约得 45 分，偏差 10% 约得 14 分；比虚线更准才算看懂了掉速。',
    ],
    scoring: '100 × e^(−相对误差 / 5%)。',
    sources: [
      { name: 'Boston Marathon 2015–2017 official results (BAA)', url: 'https://www.baa.org/races/boston-marathon/results', note: '经 GitHub 镜像 nispano/Data-Analysis-of-the-Boston-Marathon-Results-2015-2017 获取 CSV' },
    ],
    dataNote: '原想用纽约路跑（NYRR）成绩，但其官网结果只能手动查询、无法脚本获取，故改用同类的波士顿马拉松官方成绩（BAA）。从 7.9 万条有完整 5K–40K 分段记录的成绩中，按“后程掉速程度 × 年份”分层抽取 144 位（排除掉速超过 40% 的伤退/走路型成绩，那种无法预测）。为保护隐私不显示姓名。每年的天气是公开报道的概况，不属于数据集。数据为静态快照：官方成绩不提供允许跨域的接口，因此没有实时数据。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.runners).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const r = ctx.data.runners.find((x) => x.id === p.id);
    const t25 = r.sp[4];
    const ev = evenProjection(t25);
    const pc = segPaces(r.sp);
    ctx.log('runner', { y: r.y, t25, ev });

    const bars = pc.map((v, i) => ({ seg: `${KM[i] - 5}–${KM[i]}K`, v: v / 60 }));
    const lo = Math.min(...bars.map((b) => b.v), ev / 42.195 / 60), hi = Math.max(...bars.map((b) => b.v), ev / 42.195 / 60);
    const chart = await ui.plot((Plot, c) => ({
      height: 220,
      marginLeft: 48,
      marginTop: 24,
      x: { label: null, domain: bars.map((b) => b.seg) },
      y: { label: '配速 分/公里', domain: [lo - (hi - lo) * 0.6 - 0.05, hi + (hi - lo) * 0.5 + 0.05], tickFormat: (v) => pace(v * 60) },
      marks: [
        Plot.ruleY([ev / 42.195 / 60], { stroke: c.bad, strokeDasharray: '4 3' }),
        Plot.lineY(bars, { x: 'seg', y: 'v', stroke: c.accent, strokeWidth: 2 }),
        Plot.dot(bars, { x: 'seg', y: 'v', fill: c.accent, r: 5, tip: true }),
        Plot.text(bars, { x: 'seg', y: 'v', text: (b) => pace(b.v * 60), dy: -14, fill: c.ink, fontFamily: 'monospace' }),
      ],
    }));

    ctx.stage.append(ui.panel({ kicker: '前 25 公里', title: `${r.g === 'M' ? '男' : '女'}，${r.age} 岁，${r.cc}` },
      chart,
      ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '6px', flexWrap: 'wrap' } },
        ui.h('span', `25K 用时 ${hms(t25)}`),
        ui.h('span', { style: { color: 'var(--bad)' } }, `- - 虚线 = 25K 平均配速 ${pace(t25 / 25)}`)),
      ui.h('div', { class: 'small muted', style: { marginTop: '6px' } }, `赛事：波士顿马拉松 ${YEAR[r.y]}。终点前有著名的“心碎坡”（Heartbreak Hill，约 33K）。`)));

    const res = await ctx.estimate({
      title: '他几点冲线？',
      prompt: '估计完赛时间（净时间）。',
      answer: r.fin / 60,
      min: Math.floor((t25 * 1.5) / 60),
      max: Math.ceil((t25 * 2.4) / 60),
      initial: Math.round(ev / 60),
      step: 1,
      format: (v) => hms(v * 60),
      scoring: 'pct',
      scale: 0.05,
    });

    const f = fadePct(t25, r.fin);
    const tail = r.rest.map((t, i) => (t - (r.rest[i - 1] ?? t25)) / (i === 3 ? 2.195 : 5));
    const firstTrend = (pc[4] - pc[0]) / pc[0] * 100;
    const worst = tail.indexOf(Math.max(...tail.slice(0, 3)));
    const segName = ['25–30K', '30–35K', '35–40K'][worst];
    const gGuess = res.guess * 60;
    const errG = Math.abs(gGuess - r.fin) / r.fin * 100, errE = Math.abs(ev - r.fin) / r.fin * 100;
    res.detail = ui.kv([
      ['真实完赛', hms(r.fin)],
      ['你的估计', `${hms(gGuess)}（误差 ${errG.toFixed(1)}%）· ${errG < errE ? '比匀速外推更准' : '没有比匀速外推更准'}`],
      ['匀速外推', `${hms(ev)}（误差 ${errE.toFixed(1)}%，${r.fin >= ev ? '低估' : '高估'}了 ${hms(Math.abs(r.fin - ev))}）`],
      ['后程掉速', `${f >= 0 ? '+' : ''}${f.toFixed(1)}%（后 17.2K 对比前 25K 的平均配速）`],
      ['后程配速', `25–30K ${pace(tail[0])} · 30–35K ${pace(tail[1])} · 35–40K ${pace(tail[2])} · 末段 ${pace(tail[3])}`],
      ['规律', `前 25K 里 20–25K 比首个 5K ${firstTrend > 1 ? `慢了 ${firstTrend.toFixed(0)}%，掉速已经开始` : firstTrend < -1 ? `快了 ${(-firstTrend).toFixed(0)}%，越跑越快` : '几乎一样，节奏稳定'}；` +
        (f > 8 ? `后程最慢的是 ${segName}（${pace(tail[worst])}），整体明显掉速——匀速外推会严重低估。` : f > 2 ? `后程温和掉速（最慢 ${segName} ${pace(tail[worst])}），约 3–8% 是业余选手的常态。` : '后程几乎匀速甚至更快（负分段），多见于经验丰富的选手。') +
        (r.y === 2016 ? ' 这一年炎热，掉速的人更多。' : r.y === 2015 ? ' 这一年逆风有雨，整体偏慢。' : '')],
    ]);
    return res;
  },
};
