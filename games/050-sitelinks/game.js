// #50 Sitelinks — how many Wikipedia language editions cover a topic?
const LANG_ZH = { en: '英语', de: '德语', fr: '法语', es: '西班牙语', ru: '俄语', ja: '日语', zh: '中文', it: '意大利语', pt: '葡萄牙语', ar: '阿拉伯语' };

/** Pick `k` items whose counts are clearly apart (so the ranking is fair); relax the gap if the category is narrow. */
export function spread(items, k, rng) {
  for (const ratio of [0.2, 0.15, 0.11, 0.08]) {
    for (let t = 0; t < 12; t++) {
      const out = [];
      for (const it of rng.shuffle(items.slice())) {
        if (out.every((o) => Math.abs(o.n - it.n) >= Math.max(3, ratio * Math.max(o.n, it.n)))) out.push(it);
        if (out.length === k) return out;
      }
    }
  }
  return [];
}

/** Short teaching line from the count alone. */
export function tier(n) {
  if (n >= 200) return '全球级知名度：几乎每个主要语言（包括很多小语种）都有条目。';
  if (n >= 100) return '国际知名：上百个语言版本都认为值得写。';
  if (n >= 60) return '跨地区知名：主要语种几乎都有，小语种开始缺席。';
  if (n >= 30) return '区域知名：欧洲或亚洲的大语种有条目，多数小语种没有。';
  return '本地话题：只有少数语言写过，多半限于当地或某个圈子。';
}

/** Puzzle-specific explanation: which of the 10 biggest Wikipedias cover the item. */
export function explain(it) {
  const miss = it.miss || [];
  const head = `「${it.name}」被 ${it.n} 个语言版本的维基百科收录`;
  if (!miss.length) return `${head}（约占全部语言版本的 ${Math.round((it.n / TOTAL) * 100)}%），最大的 10 个维基百科全都有。${tier(it.n)}`;
  const names = miss.map((c) => LANG_ZH[c] || c).join('、');
  if (miss.length >= 6) return `${head}，最大的 10 个维基百科里有 ${miss.length} 个没有（缺${names}）：连大语种都没人写，说明话题只在很小的圈子里知名。`;
  return `${head}，最大的 10 个维基百科里缺${names}：${tier(it.n)}`;
}

const TOTAL = 340; // approx. number of Wikipedia language editions
const fmt = (v) => `${Math.round(v)} 种`;

export default {
  meta: {
    num: 50,
    slug: 'sitelinks',
    title: 'Sitelinks',
    tagline: '一个话题被多少种语言的维基百科收录？排 5 个话题，再估一个数字。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '今天有 5 个同类话题（城市、电影、化学元素……），按「有多少种语言的维基百科收录了它」从多到少排序，最多 3 次机会，每次只告诉你几个位置对了。',
      '然后估另一个话题（换了类别）的语言版本数，滑块是对数刻度：差 2 倍约得 37 分，差 20% 约得 77 分。',
      '数字只统计维基百科的语言版本（共约 340 种），不含维基共享资源、维基语录等姊妹项目。',
      '直觉：世界性的话题 200+ 种语言；本国人才熟悉的话题通常只有三四十种；最大的 10 个维基百科是否都有，是很好的线索。',
    ],
    scoring: '排序 100 分（按位置对错，重试扣分），估数 100 分（对数误差，差 2 倍约 37 分），总分 200。',
    sources: [
      { name: 'Wikidata API（wbgetentities，sitelinks）', url: 'https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities', note: 'CC0' },
      { name: 'Wikidata Query Service（候选条目）', url: 'https://query.wikidata.org/', note: 'CC0' },
    ],
    dataNote: '数据是 Wikidata 的快照（见 data.json 的 fetched 日期）：每类从 Wikidata 随机抽取已有较多语言版本的条目，统计各条目里以 "wiki" 结尾的站点（去掉共享资源、物种、元维基等非百科站点）。语言版本数会随时间缓慢增长；浏览器端的 Wikidata API 虽然支持跨域，但今天的题目不需要实时数据，所以固定使用快照，保证所有人拿到同一道题。条目名与简介沿用英文原文。',
  },

  puzzle({ data, rng, pick }) {
    const cat = pick(data.cats);
    const items = spread(cat.items, 5, rng);
    // estimate target: an item from a DIFFERENT category, so the ranking reveal cannot leak its count
    const other = rng.pick(data.cats.filter((c) => c.key !== cat.key));
    const target = rng.pick(other.items);
    return { cat: cat.zh, items, tcat: other.zh, target };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('sitelinks puzzle', p.cat, p.items.map((i) => `${i.name}=${i.n}`).join(', '), '| target', p.target.name, p.target.n);
    const sub = (i) => [i.zh, i.desc].filter(Boolean).join(' · ');
    const r1 = await ctx.order({
      title: `排名：这 5 个${p.cat}，谁的语言版本最多？`,
      prompt: '从多到少排列（拖动或用 ↑↓）。数字统计的是维基百科的语言版本数。',
      items: p.items.map((i) => ({ id: i.id, label: i.name, sub: sub(i), value: i.n })),
      direction: 'desc',
      attempts: 3,
      format: fmt,
    });
    const t = p.target;
    const r2 = await ctx.estimate({
      title: `估数：「${t.name}」有多少种语言版本？`,
      prompt: `${p.tcat}：${sub(t)}`,
      answer: t.n, min: 10, max: 400, log: true, step: 1, initial: 60,
      format: fmt, scoring: 'log', scale: 0.3,
    });
    const res = ctx.combine([r1, r2]);
    const sorted = p.items.slice().sort((a, b) => b.n - a.n);
    const hi = sorted[0], lo = sorted[sorted.length - 1];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [{ key: 'name', label: p.cat }, { key: 'n', label: '语言版本数', num: true }, { key: 'miss', label: '占全部版本', num: true, fmt: (_, r) => `${Math.round((r.n / TOTAL) * 100)}%` }],
        rows: sorted,
      }),
      ui.callout(`排名线索：${hi.name} ${hi.n} 种，${lo.name} 只有 ${lo.n} 种，相差 ${(hi.n / lo.n).toFixed(1)} 倍。${explain(hi)}`),
      ui.callout(`估数答案：${explain(t)}`),
      ui.h('div', { class: 'small muted' }, '线索：条目是否世界性、有没有跨文化的翻译需求，比体量本身更能预测语言数。'));
    return res;
  },
};
