// #16 Grade — three real violations from one NYC restaurant inspection; guess the score and the letter grade.

export const gradeOf = (score) => (score <= 13 ? 'A' : score <= 27 ? 'B' : 'C');

/** Scoring for the numeric guess: 100 at exact, decays with absolute error. */
export function scoreGuess(guess, answer, scale = 8) {
  return Math.round(100 * Math.exp(-Math.abs(guess - answer) / scale));
}

/** Typical points of one violation: [min, median, max, n] from inspections that cited only it. */
export const ptsOf = (pts, v) => pts?.[`${v.code}|${v.crit ? 'C' : 'G'}`] ?? null;

/** Sum of the per-violation medians — the "rule of thumb" total. */
export function typicalTotal(item, pts) {
  return item.v.reduce((s, v) => s + (ptsOf(pts, v)?.[1] ?? 0), 0);
}

/** Why the total came out the way it did, specific to this inspection. */
export function explain(item, pts) {
  const crit = item.v.filter((x) => x.crit).length;
  const typ = typicalTotal(item, pts);
  const diff = item.score - typ;
  const parts = [`三条里有 ${crit} 条 Critical、${3 - crit} 条 General；按各自的典型分值相加约 ${typ} 分，实际 ${item.score} 分`];
  if (Math.abs(diff) <= 2) parts.push('，基本吻合：这次检查里每条都扣的是常见分值。');
  else if (diff > 0) parts.push(`，高出 ${diff} 分：至少有一条的严重程度或影响范围高于常见情形（扣分随情节加重，最高档可达 28 分）。`);
  else parts.push(`，低出 ${-diff} 分：违规情节偏轻，几条都扣在分值区间的低端。`);
  return parts.join('');
}

export default {
  meta: {
    num: 16,
    slug: 'grade',
    title: 'Grade',
    tagline: '一次纽约餐厅检查里的三条真实违规记录。猜它的总扣分，再猜门口贴的字母等级。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '卫生局检查员在一家纽约餐厅记下了三条违规（附中文译注和英文原文）。这次检查的结果只来自这三条。',
      '先估总扣分，分数越低越好。经验：每条 Critical 违规约扣 5–10 分，General 约扣 2–5 分；情节特别严重的（比如没有洗手设施）一条就能扣到 28 分。',
      '再选字母等级：0–13 分是 A，14–27 分是 B，28 分及以上是 C。',
    ],
    scoring: '扣分：100 × e^(−误差/8)，差 1 分约少 12 分；等级猜对 100。两项相加，满分 200。',
    sources: [
      { name: 'NYC Open Data · DOHMH Restaurant Inspection Results', url: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j' },
      { name: 'NYC Health · Restaurant grading and scoring', url: 'https://www.nyc.gov/site/doh/business/food-operators/letter-grading-for-restaurants.page' },
    ],
    dataNote: '快照：2024 年以来、恰好记录了 3 条违规且带 A/B/C 等级的检查，每个得分档最多取 7 家，所以 B、C 比真实比例多（现实里绝大多数检查是 A）。单条违规的分值不在公开数据里；结果页的“典型分值”取自只记录了这一条违规的检查的总分中位数。违规中文为译注，英文为官方原文。',
  },

  puzzle({ data, pick }) {
    return { item: pick(data.items) };
  },

  async play(ctx, { item }) {
    const { ui } = ctx;
    const { pts, zh } = ctx.data;
    ctx.log('inspection', item.name, item.date, item.score, item.grade);
    ctx.stage.append(ui.panel({ kicker: `${item.boro} · ${item.cuisine}`, title: '三条违规记录' },
      ui.h('div', { class: 'ds-stack' },
        item.v.map((x, i) => ui.h('div', { class: 'ds-stack', style: { gap: '4px' } },
          ui.h('div', { class: 'ds-row', style: { gap: '8px', alignItems: 'center' } },
            ui.badge(x.crit ? 'Critical' : 'General', x.crit ? 'bad' : undefined),
            ui.h('span', { class: 'mono small muted' }, `${i + 1} · ${x.code}`)),
          ui.h('div', zh?.[x.code] ?? x.text),
          zh?.[x.code] ? ui.h('div', { class: 'small muted' }, x.text) : null)))));

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
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['餐厅', `${item.name}（${item.boro}，${item.cuisine}）`],
        ['检查日期', item.date],
        ['实际扣分', `${item.score} 分 → 等级 ${gr}`],
      ]),
      ui.h('div', { class: 'ds-stack', style: { gap: '6px' } },
        item.v.map((x) => {
          const p = ptsOf(pts, x);
          return ui.h('div', { class: 'ds-row', style: { gap: '8px', alignItems: 'baseline' } },
            ui.badge(x.crit ? 'Critical' : 'General', x.crit ? 'bad' : undefined),
            ui.h('span', { class: 'small' }, `${zh?.[x.code] ?? x.code}`),
            p ? ui.h('span', { class: 'mono small muted' }, `典型 ${p[1]} 分（${p[0]}–${p[2]}，n=${p[3]}）`) : null);
        })),
      ui.h('div', explain(item, pts)));
    return res;
  },
};
