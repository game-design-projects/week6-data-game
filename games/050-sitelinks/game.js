// #50 Sitelinks — how many Wikipedia/Wikimedia language editions cover a topic?
/** Pick `k` items whose counts are clearly apart (so the ranking is fair). */
export function spread(items, k, rng) {
  const out = [];
  for (const it of rng.shuffle(items.slice())) {
    if (out.every((o) => Math.abs(o.n - it.n) >= Math.max(3, 0.15 * Math.max(o.n, it.n)))) out.push(it);
    if (out.length === k) break;
  }
  return out;
}

/** Why is it famous? A short teaching line from the count alone. */
export function tier(n) {
  if (n >= 200) return '全球级知名度：几乎每个主要语言（包括很多小语种）都有条目。';
  if (n >= 100) return '国际知名：上百个语言版本都认为值得写。';
  if (n >= 40) return '地区知名：主要语种和周边语言有条目，小语种基本没有。';
  if (n >= 15) return '只在少数大语种里有条目，多半是本地话题。';
  return '本地话题：只有寥寥几种语言写过。';
}

export default {
  meta: {
    num: 50,
    slug: 'sitelinks',
    title: 'Sitelinks',
    tagline: '一个话题被多少种语言的维基百科收录？先给 5 个话题排名，再估一个具体数字。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '今天有 5 个同类话题（城市、电影、化学元素……），按「被多少种语言版本收录」从多到少排序，最多 3 次机会。',
      '然后估一个话题的语言版本数，滑块是对数刻度：差 2 倍约扣六成分。',
      '数字是 Wikidata 的 sitelinks 总数，包含各语种维基百科，也含维基共享资源、维基语录等姊妹项目。',
      '直觉：世界性的话题 200+ 种语言；本国人才熟悉的话题通常只有十几种。',
    ],
    scoring: '排序 100 分（按位置对错，重试扣分），估数 100 分（对数误差，差 2 倍约 37 分），总分 200。',
    sources: [{ name: 'Wikidata Query Service（wikibase:sitelinks）', url: 'https://query.wikidata.org/', note: 'CC0' }],
    dataNote: '数据来自 Wikidata SPARQL 随机抽样，每类约 100 条，sitelinks 为抓取当日数字，会随时间缓慢增长。',
  },

  puzzle({ data, rng, pick }) {
    const cat = pick(data.cats);
    const items = spread(cat.items, 5, rng);
    return { cat: cat.zh, items, target: rng.int(0, items.length - 1) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('sitelinks puzzle', p.cat, p.items.map((i) => `${i.name}=${i.n}`).join(', '));
    const target = p.items[p.target];
    const r1 = await ctx.order({
      title: `排名：这 5 个${p.cat}，谁的语言版本最多？`,
      prompt: '从多到少排列（拖动或用 ↑↓）。',
      items: p.items.map((i) => ({ id: i.id, label: i.name, sub: i.desc, value: i.n })),
      direction: 'desc',
      attempts: 3,
      format: (v) => `${v} 种`,
    });
    const r2 = await ctx.estimate({
      title: `估数：「${target.name}」有多少种语言版本？`,
      prompt: target.desc || p.cat,
      answer: target.n, min: 1, max: 400, log: true, step: 1, initial: 30,
      format: (v) => `${Math.round(v)} 种`, scoring: 'log', scale: 0.3,
    });
    const res = ctx.combine([r1, r2]);
    const sorted = p.items.slice().sort((a, b) => b.n - a.n);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({ columns: [{ key: 'name', label: p.cat }, { key: 'n', label: '语言版本数', num: true }, { key: 'desc', label: '简介' }], rows: sorted }),
      ui.callout(`「${target.name}」：${tier(target.n)}`),
      ui.h('div', { class: 'small muted' }, '线索：条目是否世界性、有没有跨文化的翻译需求，比体量本身更能预测语言数。'));
    return res;
  },
};
