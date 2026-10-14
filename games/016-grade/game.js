// #16 Grade — three real violations from one NYC restaurant inspection; guess the score and the letter grade.

export const gradeOf = (score) => (score <= 13 ? 'A' : score <= 27 ? 'B' : 'C');

/** Scoring for the numeric guess: 100 at exact, decays with absolute error. */
export function scoreGuess(guess, answer, scale = 8) {
  return Math.round(100 * Math.exp(-Math.abs(guess - answer) / scale));
}

export default {
  meta: {
    num: 16,
    slug: 'grade',
    title: 'Grade',
    tagline: '一次纽约餐厅检查里的三条真实违规记录。猜它的扣分，再猜门口贴的字母等级。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '卫生局检查员在一家纽约餐厅发现了三条违规，下面列出原文（已译注）。检查结果只有这三条。',
      '先估计总扣分：分数越低越好，违规越严重（标 Critical）、越多人受影响，扣得越多。',
      '再选字母等级：0–13 分是 A，14–27 分是 B，28 分及以上是 C。',
    ],
    scoring: '扣分：100 × e^(−误差/8)；等级：猜对得 100。两项取平均。',
    sources: [
      { name: 'NYC Open Data · DOHMH Restaurant Inspection Results', url: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j' },
    ],
    dataNote: '只收录恰好记录了 3 条违规的检查（2024 年以来，等级为 A/B/C 的检查）。违规描述为官方英文原文。单项违规的具体分值不在公开数据里，需要靠经验判断。',
  },

  puzzle({ data, pick }) {
    return { item: pick(data.items) };
  },

  async play(ctx, { item }) {
    const { ui } = ctx;
    ctx.log('inspection', item.name, item.date, item.score, item.grade);
    ctx.stage.append(ui.panel({ kicker: `${item.boro} · ${item.cuisine}`, title: '三条违规记录' },
      ui.h('div', { class: 'ds-stack' },
        item.v.map((x, i) => ui.h('div', { class: 'ds-row', style: { gap: '10px', alignItems: 'flex-start' } },
          ui.badge(x.crit ? 'Critical' : 'General', x.crit ? 'bad' : undefined),
          ui.h('div', ui.h('span', { class: 'mono small muted' }, `${i + 1} · ${x.code}  `), x.text))))));

    const r1 = await ctx.estimate({
      answer: item.score, min: 0, max: 60, initial: 12, step: 1, log: false,
      title: '总扣分是多少？', scoring: (g, a) => scoreGuess(g, a) / 100, format: (v) => `${Math.round(v)} 分`,
    });
    const gr = gradeOf(item.score);
    const labels = [['A', '0–13 分'], ['B', '14–27 分'], ['C', '28 分以上']];
    const r2 = await ctx.rounds({
      rounds: [{ prompt: '门口会贴哪个等级？', options: labels.map(([l, s]) => ({ label: l, sub: s })), correct: 'ABC'.indexOf(gr),
        explain: `实际 ${item.score} 分，等级 ${gr}` }],
    });
    const r2n = { ...r2, score: r2.score ? 100 : 0, max: 100 };
    const res = ctx.combine([r1, r2n]);
    const crit = item.v.filter((x) => x.crit).length;
    res.detail = ui.kv([
      ['餐厅', `${item.name}（${item.boro}，${item.cuisine}）`],
      ['检查日期', item.date],
      ['实际扣分', `${item.score} 分 → 等级 ${gr}`],
      ['规律', `三条违规里有 ${crit} 条 Critical。Critical 违规直接威胁食品安全，扣分通常高于 General；每条按严重程度和影响范围计分，三条加总就是总扣分。`],
    ]);
    return res;
  },
};
