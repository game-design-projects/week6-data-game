// #31 Rent Index — guess a county's HUD Fair Market Rent for a 2-bedroom, then three higher/lower duels.

/** Pick `n` rival counties whose 2BR FMR differs from the target by ≥ minGap (fraction). */
export function pickRivals(counties, target, rng, n = 3, minGap = 0.12) {
  const ok = counties.filter((c) => c !== target && Math.abs(c.fmr[2] - target.fmr[2]) / target.fmr[2] >= minGap);
  return rng.sample(ok, n);
}

export default {
  meta: {
    num: 31,
    slug: 'rent-index',
    title: 'Rent Index',
    tagline: '猜一个美国县的两居室公平市场租金（HUD FMR），再比三组高低。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '给你一个美国县的名称、州、人口和所属都会区。猜它两居室的月租金（HUD 公平市场租金，FY2025）。',
      '最多 3 次机会，每次猜完会告诉你该调高还是调低；多用一次扣 10% 的分。',
      '接着是三道比大小：这个县和另一个县，谁的两居室租金更高。',
      '计分：估值误差越小越高（约偏 20% 得 37 分），最后加上比大小得分。',
    ],
    scoring: '估值 100 分（按百分比误差衰减）+ 比大小每题答对计分，合并为总分。',
    sources: [{ name: 'HUD Fair Market Rents FY2025（县级）', url: 'https://www.huduser.gov/portal/datasets/fmr.html', note: 'FY25_FMRs_revised.xlsx，含 2022 年人口' }],
    dataNote: 'FMR 是 HUD 为住房补贴设定的约第 40 百分位的市场租金，不等于平均租金。数据只含人口 ≥ 4 万的县（新英格兰为镇）。',
  },

  puzzle({ data, pick, rng }) {
    const c = pick(data.counties);
    const rivals = pickRivals(data.counties, c, rng).map((r) => data.counties.indexOf(r));
    return { i: data.counties.indexOf(c), rivals };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const D = ctx.data;
    const c = D.counties[p.i];
    const $ = (v) => core.fmtMoney(v);
    ctx.log('county', c.name, c.st, c.fmr[2]);

    ctx.stage.append(ui.panel({ kicker: 'HUD FY2025 · 两居室月租', title: `${c.name}，${c.st}` },
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px' } },
        ui.stat({ label: '人口', value: core.fmtCompact(c.pop), sub: '2022' }),
        ui.stat({ label: `${c.st} 州中位县`, value: $(D.stateMed[c.st]), sub: '两居室' }),
        ui.stat({ label: '全美中位县', value: $(D.nat), sub: '两居室' })),
      ui.h('p', { class: 'small ink2', style: { marginTop: '10px' } }, `所属租金区：${c.area}`)));

    const r1 = await ctx.estimate({
      title: '这个地区两居室的月租是多少？',
      answer: c.fmr[2], min: 300, max: 5000, log: true, step: 5, initial: D.nat,
      format: $, attempts: 3, scoring: 'pct', scale: 0.2, tolerance: 0.03,
    });

    const rivals = p.rivals.map((i) => D.counties[i]);
    const r2 = await ctx.rounds({
      title: '比大小',
      rounds: rivals.map((o, k) => {
        const flip = (p.i + k) % 2;
        const opts = flip ? [o, c] : [c, o];
        return {
          prompt: '谁的两居室租金更高？',
          options: opts.map((x) => ({ label: `${x.name}, ${x.st}`, sub: `人口 ${core.fmtCompact(x.pop)}` })),
          correct: opts[0].fmr[2] > opts[1].fmr[2] ? 0 : 1,
          explain: `${c.name} ${$(c.fmr[2])} vs ${o.name} ${$(o.fmr[2])}`,
        };
      }),
    });

    const res = ctx.combine([r1, r2]);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', `${$(c.fmr[2])} / 月`],
        ['你的估值', r1.guess != null ? $(r1.guess) : (r1.summary || '')],
        ['全部户型', `开间 ${$(c.fmr[0])} · 一居 ${$(c.fmr[1])} · 两居 ${$(c.fmr[2])} · 三居 ${$(c.fmr[3])} · 四居 ${$(c.fmr[4])}`],
        ['规律', c.fmr[2] > D.stateMed[c.st] * 1.2 ? '明显高于本州中位县：多半是大都会或旅游/高收入地区。' : c.fmr[2] < D.stateMed[c.st] * 0.85 ? '低于本州中位县：偏农村或经济较弱的地区。' : '接近本州中位水平。']]));
    return res;
  },
};
