const YEARS = ['2018', '2019', '2021', '2022', '2023', '2024', '2025'];
const BANDS = [[2, 6], [1.6, 2.2], [1.35, 1.8], [1.2, 1.45], [1.08, 1.25]];

// Pure: pick `year`, then 5 zip pairs of growing difficulty. Each pair: [zipA, zipB] (ratio of rat-fails within band).
export function buildPairs(rows, rng) {
  const used = new Set();
  const out = [];
  for (const [lo, hi] of BANDS) {
    const pool = rng.shuffle(rows.filter((r) => !used.has(r[0])));
    let found = null;
    for (let widen = 0; widen < 4 && !found; widen++) {
      const l = 1 + (lo - 1) / (1 + widen * 0.5), h = hi + widen * 0.5;
      for (let i = 0; i < pool.length && !found; i++)
        for (let j = i + 1; j < pool.length; j++) {
          const r = Math.max(pool[i][1], pool[j][1]) / Math.min(pool[i][1], pool[j][1]);
          if (r >= l && r <= h) { found = [pool[i], pool[j]]; break; }
        }
    }
    if (!found) break;
    found.forEach((f) => used.add(f[0]));
    out.push(found.map((f) => f[0]));
  }
  return out;
}

export default {
  meta: {
    num: 19,
    slug: 'rat-race',
    title: 'Rat Race',
    tagline: '两个纽约邮编，谁的鼠患检查不合格次数更多？',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '每一轮给出两个纽约邮编区，以及它们在某一年里被卫生局检查的总次数。',
      '选出「发现鼠迹而不合格」次数更多的那一个，共 5 轮，越往后差距越小。',
      '注意：检查次数多不等于鼠患重，可能只是被查得多。每轮答完会揭晓真实数字。',
    ],
    scoring: '每答对一轮得 1 分，满分 5。',
    sources: [
      { name: 'NYC Open Data · Rodent Inspection (DOHMH)', url: 'https://data.cityofnewyork.us/Health/Rodent-Inspection/p937-wjvj', note: '统计 result 为 “Failed for Rat Activity”（含“及其他原因”）的检查数' },
    ],
    dataNote: '数据已按邮编和年份预聚合；仅保留当年至少 150 次有结论检查的邮编。2020 与不完整的 2026 年未使用。',
  },

  puzzle({ data, pick, rng }) {
    const year = pick(YEARS.filter((y) => data.years[y]));
    const rows = data.years[year].slice().sort((a, b) => a[0].localeCompare(b[0]));
    return { year, pairs: buildPairs(rows, rng) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const by = new Map(ctx.data.years[p.year].map((r) => [r[0], r]));
    const boro = ctx.data.boros;
    const flip = p.pairs.map((_, i) => ctx.rng.chance(0.5));
    const fmt = ctx.core.fmtNum;
    const rounds = p.pairs.map(([a, b], i) => {
      const pr = flip[i] ? [b, a] : [a, b];
      const [x, y] = pr.map((z) => by.get(z));
      const win = x[1] > y[1] ? 0 : 1;
      const rate = (r) => ((r[1] / r[2]) * 100).toFixed(0);
      return {
        prompt: `第 ${i + 1} 轮 · ${p.year} 年，哪个邮编不合格更多？`,
        options: pr.map((z) => ({ label: z, sub: `${boro[z]} · 共检查 ${fmt(by.get(z)[2])} 次` })),
        correct: win,
        explain: `${x[0]}：${fmt(x[1])} 次不合格（${rate(x)}%）；${y[0]}：${fmt(y[1])} 次不合格（${rate(y)}%）。`,
      };
    });
    ctx.log('rat-race rounds', p.year, p.pairs);
    const panel = ui.panel({ kicker: p.year + ' 年', title: '鼠患检查不合格数' }, ui.h('p', { class: 'ink2' }, '纽约卫生局上门检查老鼠：发现鼠迹即记为“不合格”。'));
    ctx.stage.append(panel);
    const res = await ctx.rounds({ rounds, minWidth: 150 });
    const top = [...by.values()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topRate = [...by.values()].filter((r) => r[2] >= 500).sort((a, b) => b[1] / b[2] - a[1] / a[2])[0];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `${p.year} 年不合格次数最多的邮编：`),
      ui.table({
        columns: [{ key: 'z', label: '邮编' }, { key: 'b', label: '区' }, { key: 'f', label: '不合格', num: true }, { key: 'r', label: '不合格率', num: true }],
        rows: top.map((r) => ({ z: r[0], b: boro[r[0]], f: fmt(r[1]), r: ((r[1] / r[2]) * 100).toFixed(0) + '%' })),
      }),
      ui.h('div', { class: 'small muted' }, `规律：被查得多的邮编，不合格数通常也更多；但不合格率最高的是 ${topRate[0]}（${boro[topRate[0]]}，${((topRate[1] / topRate[2]) * 100).toFixed(0)}%），看“率”才是真正的鼠患。`));
    return res;
  },
};
