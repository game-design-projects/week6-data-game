const BANDS = [[2, 6], [1.6, 2.2], [1.35, 1.8], [1.2, 1.45], [1.08, 1.25]];
const MIN_FAILS = 12, MIN_DIFF = 6; // keep every pair clearly separable: no ties, no 3-vs-4 coin flips

// Pure: 5 zip pairs of growing difficulty from one month's rows [zip, fails, inspections].
// Each pair's ratio of rat-failures falls in a band that tightens round by round.
export function buildPairs(rows, rng) {
  const used = new Set();
  const out = [];
  const ok = (a, b) => {
    const hi = Math.max(a[1], b[1]), lo = Math.min(a[1], b[1]);
    return lo >= MIN_FAILS && hi - lo >= MIN_DIFF ? hi / lo : 0;
  };
  for (const [lo, hi] of BANDS) {
    const pool = rng.shuffle(rows.filter((r) => !used.has(r[0])));
    let found = null;
    for (let widen = 0; widen < 5 && !found; widen++) {
      const l = widen === 4 ? 1.03 : 1 + (lo - 1) / (1 + widen * 0.5), h = hi + widen * 0.5;
      for (let i = 0; i < pool.length && !found; i++)
        for (let j = i + 1; j < pool.length; j++) {
          const r = ok(pool[i], pool[j]);
          if (r && r >= l && r <= h) { found = [pool[i], pool[j]]; break; }
        }
    }
    if (!found) break;
    found.forEach((f) => used.add(f[0]));
    out.push(found.map((f) => f[0]));
  }
  return out;
}

export const monthLabel = (m) => `${m.slice(0, 4)} 年 ${+m.slice(5)} 月`;

// Pure: what the round-by-round results teach about this month.
export function lessonStats(pairs, by) {
  let countWins = 0, rateWins = 0, upsets = 0;
  for (const [a, b] of pairs) {
    const x = by.get(a), y = by.get(b);
    const hi = x[1] > y[1] ? x : y, lo = hi === x ? y : x;
    if (hi[2] > lo[2]) countWins++;
    if (hi[1] / hi[2] > lo[1] / lo[2]) rateWins++;
    if (hi[2] < lo[2]) upsets++;
  }
  return { countWins, rateWins, upsets, n: pairs.length };
}

export default {
  meta: {
    num: 19,
    slug: 'rat-race',
    title: 'Rat Race',
    tagline: '两个纽约邮编，谁这个月的鼠患检查不合格次数更多？',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '每天抽一个月份（2018 年至今），每一轮给出两个纽约邮编区，以及它们在该月被卫生局检查的总次数。',
      '选出该月「发现鼠迹而不合格」次数更多的那一个，共 5 轮，越往后两者差距越小。',
      '检查次数多不等于鼠患重，可能只是被查得多；每轮答完会揭晓不合格数和不合格率。',
    ],
    scoring: '每答对一轮得 1 分，满分 5。纯猜平均约 2.5 分，会看检查次数和区域规律能稳定拿到 4 分以上。',
    sources: [
      { name: 'NYC Open Data · Rodent Inspection (DOHMH)', url: 'https://data.cityofnewyork.us/Health/Rodent-Inspection/p937-wjvj', note: '统计 result 为 “Failed for Rat Activity”（含“及其他原因”）的检查数；分母为 Passed / Failed 类有结论检查' },
    ],
    dataNote: '数据已按邮编和月份预聚合（快照，build/ 可重新生成）：仅保留当月至少 60 次有结论检查的邮编，每个月至少 30 个邮编才会入选；不合格数都不少于 12 次且每对差距不少于 6 次。2020 年疫情期间与 2021 年初检查量太低的月份、以及尚未完整的最近月份不使用。该数据集每日更新，但按月统计需要等月份结束后才稳定，所以未做实时抓取。',
  },

  puzzle({ data, pick, rng }) {
    const month = pick(Object.keys(data.months).sort());
    const rows = data.months[month];
    return { month, pairs: buildPairs(rows, rng) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const by = new Map(ctx.data.months[p.month].map((r) => [r[0], r]));
    const boro = ctx.data.boros;
    const flip = p.pairs.map(() => ctx.rng.chance(0.5));
    const fmt = ctx.core.fmtNum;
    const when = monthLabel(p.month);
    const rate = (r) => ((r[1] / r[2]) * 100).toFixed(0);
    const rounds = p.pairs.map(([a, b], i) => {
      const pr = flip[i] ? [b, a] : [a, b];
      const [x, y] = pr.map((z) => by.get(z));
      const win = x[1] > y[1] ? 0 : 1;
      return {
        prompt: `第 ${i + 1} 轮 · ${when}，哪个邮编不合格更多？`,
        options: pr.map((z) => ({ label: z, sub: `${boro[z]} · 共检查 ${fmt(by.get(z)[2])} 次` })),
        correct: win,
        explain: `${x[0]}：${fmt(x[1])} 次不合格（占 ${rate(x)}%）；${y[0]}：${fmt(y[1])} 次不合格（占 ${rate(y)}%）`,
      };
    });
    ctx.log('rat-race rounds', p.month, p.pairs);
    ctx.stage.append(ui.panel({ kicker: when, title: '鼠患检查不合格数' }, ui.h('p', { class: 'ink2' }, '纽约卫生局上门检查老鼠：发现鼠迹即记为“不合格”。比的是该月不合格的次数，不是比例。')));
    const res = await ctx.rounds({ rounds, minWidth: 150 });
    const rows = [...by.values()];
    const top = rows.slice().sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topRate = rows.filter((r) => r[2] >= 150).sort((a, b) => b[1] / b[2] - a[1] / a[2])[0];
    const L = lessonStats(p.pairs, by);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `本期 ${L.n} 对里，不合格更多的一方检查次数也更多的有 ${L.countWins} 对，检查更少却反超的有 ${L.upsets} 对；不合格率也更高的有 ${L.rateWins} 对。${L.countWins >= L.n - 1 ? '检查次数几乎就是答案——被查得多，不合格数自然多。' : '这个月光看检查次数会被骗，要结合区域和不合格率判断。'}`),
      ui.h('div', { class: 'ink2' }, `${when}不合格次数最多的邮编：`),
      ui.table({
        columns: [{ key: 'z', label: '邮编' }, { key: 'b', label: '区' }, { key: 'f', label: '不合格', num: true }, { key: 'r', label: '不合格率', num: true }],
        rows: top.map((r) => ({ z: r[0], b: boro[r[0]], f: fmt(r[1]), r: rate(r) + '%' })),
      }),
      ui.h('div', { class: 'small muted' }, `不合格率最高的是 ${topRate[0]}（${boro[topRate[0]]}，${rate(topRate)}%，检查 ${fmt(topRate[2])} 次）：看“率”才是真正的鼠患程度，看“次数”只是反映被查得多不多。`));
    return res;
  },
};
