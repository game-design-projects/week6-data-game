// #65 Trajectory — a country's 200-year path on the income x life-expectancy chart; name it.
const zh = (cc, fb) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(cc) || fb; } catch { return fb; } };
const REGION = { africa: '非洲', americas: '美洲', asia: '亚洲', europe: '欧洲' };

/** Largest single-step drop in life expectancy (pts are [year, income, lex]). */
export function worstDip(pts) {
  let best = { drop: 0, year: pts[0][0] };
  for (let i = 1; i < pts.length; i++) {
    const drop = pts[i - 1][2] - pts[i][2];
    if (drop > best.drop) best = { drop: Math.round(drop * 10) / 10, year: pts[i][0] };
  }
  return best;
}
export const at = (pts, year) => pts.reduce((b, p) => (Math.abs(p[0] - year) < Math.abs(b[0] - year) ? p : b));
/** Year life expectancy first passed `lex`, or null. */
export function firstAbove(pts, lex) { const p = pts.find((q) => q[2] >= lex); return p ? p[0] : null; }

export default {
  meta: {
    num: 65,
    slug: 'trajectory',
    title: 'Trajectory',
    tagline: '某国 200 年来在“收入 × 预期寿命”图上走过的轨迹。看路线，说出是哪个国家。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '图上横轴是人均收入（对数，按购买力和通胀调整），纵轴是出生时预期寿命，线是某国 1800–2014 年的轨迹。',
      '从列表里选一个国家来猜，最多 6 次。每猜错一次解锁一条新线索。',
      '每次猜测会显示它所在的大洲、2014 年收入比答案高还是低、预期寿命差几岁。',
      '提示：战争、饥荒、内战会让轨迹向下“砸”出缺口；早早起飞的是工业化先行者。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'Gapminder World（GDP/人均 PPP，通胀调整）', url: 'https://github.com/open-numbers/ddf--gapminder--gapminder_world' },
      { name: 'Gapminder 预期寿命（life_expectancy_years）', url: 'https://www.gapminder.org/data/documentation/gd004/' },
    ],
    dataNote: '数据为 Gapminder 的历史估算，1800 年前后的数值多为推算；每 2 年取一个点，仅保留 1800–2014 年数据完整的 184 个国家。',
  },

  puzzle({ data, pick }) {
    return { cc: pick(data.countries).cc };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const by = new Map(ctx.data.countries.map((c) => [c.cc, c]));
    const ans = by.get(p.cc);
    const pts = ans.pts;
    const last = pts[pts.length - 1];
    const dip = worstDip(pts);
    ctx.log('answer', ans.cc, 'dip', dip);

    const marks = [];
    for (const q of pts.filter((r) => r[0] % 10 === 0 || r[0] === 2014)) {
      const m = marks[marks.length - 1];
      if (!m || Math.hypot((Math.log10(q[1]) - Math.log10(m.i)) * 60, (q[2] - m.l) * 0.7) > 7 || q[0] === 2014) marks.push({ y: String(q[0]), i: q[1], l: q[2] });
    }
    const chart = await ui.plot((Plot, c) => ({
      height: 320,
      marginLeft: 40,
      x: { type: 'log', label: '人均收入 $（对数）→', domain: [200, 80000], ticks: [300, 1000, 3000, 10000, 30000], tickFormat: (v) => (v >= 1000 ? `${v / 1000}k` : v) },
      y: { label: '↑ 预期寿命（岁）', domain: [10, 90], grid: true },
      marks: [
        Plot.line(pts, { x: (q) => q[1], y: (q) => q[2], stroke: c.accent, strokeWidth: 2 }),
        Plot.dot(marks, { x: 'i', y: 'l', fill: c.ink, r: 3 }),
        Plot.text(marks, { x: 'i', y: 'l', text: 'y', dy: -9, fill: c.ink2, fontSize: 11 }),
      ],
    }));

    const keyYears = [1800, 1850, 1900, 1950, 2000, 2014];
    const table = ui.table({
      columns: [{ key: 'y', label: '年份' }, { key: 'i', label: '人均收入 $', num: true }, { key: 'l', label: '预期寿命', num: true }],
      rows: keyYears.map((y) => { const q = at(pts, y); return { y, i: ctx.core.fmtNum(q[1]), l: q[2] }; }),
    });
    const clues = [
      chart,
      `它位于${REGION[ans.region] || '世界某处'}。`,
      ui.h('div', '关键年份的数字：', table),
      dip.drop >= 1 ? `预期寿命最大的一次单步下跌发生在 ${dip.year} 年，一下掉了 ${dip.drop} 岁。` : '它的预期寿命几乎从未明显倒退。',
      `英文国名以 “${ans.name[0]}” 开头。`,
    ];

    const options = ctx.data.countries.map((c) => ({ id: c.cc, label: zh(c.cc, c.name), hint: c.name, aliases: [c.name, c.cc] }));
    const res = await ctx.guess({
      options,
      answer: ans.cc,
      maxGuesses: 6,
      title: '这条轨迹属于哪个国家？',
      placeholder: '输入国家名（中文或英文）…',
      clues,
      cluesTitle: '轨迹与线索',
      columns: ['大洲', '2014 收入', '寿命差'],
      near: (g, a) => by.get(g.id).region === by.get(a.id).region,
      feedback: (g) => {
        const gc = by.get(g.id), gl = gc.pts[gc.pts.length - 1];
        if (gc.cc === ans.cc) return [{ text: REGION[gc.region], state: 'hit' }, { text: '🎯', state: 'hit' }, { text: '0', state: 'hit', num: true }];
        const ratio = last[1] / gl[1], dl = last[2] - gl[2];
        return [
          { text: REGION[gc.region] || '—', state: gc.region === ans.region ? 'near' : undefined },
          { text: `${ratio >= 1 ? '↑' : '↓'} ${ratio >= 1 ? ratio.toFixed(1) : (1 / ratio).toFixed(1)}×`, num: true, state: Math.abs(Math.log(ratio)) < 0.3 ? 'near' : undefined },
          { text: `${dl >= 0 ? '+' : ''}${dl.toFixed(1)}`, num: true, state: Math.abs(dl) < 2 ? 'near' : undefined },
        ];
      },
    });

    const t70 = firstAbove(pts, 70);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', `${zh(ans.cc, ans.name)}（${ans.name}）`],
        ['1800 年', `$${ctx.core.fmtNum(pts[0][1])}，预期寿命 ${pts[0][2]} 岁`],
        ['2014 年', `$${ctx.core.fmtNum(last[1])}，预期寿命 ${last[2]} 岁`],
        ['预期寿命首次达到 70 岁', t70 ? `${t70} 年` : '至今未达到'],
        ['最大倒退', dip.drop >= 1 ? `${dip.year} 年 −${dip.drop} 岁` : '无明显倒退'],
      ]),
      ui.h('div', { class: 'small muted' }, '读图技巧：起点越靠右上，工业化越早；轨迹突然下坠通常对应战争、饥荒或疫病。'));
    return res;
  },
};
