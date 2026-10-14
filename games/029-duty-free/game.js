// #29 Duty Free — a absurdly specific line of the US tariff schedule; guess its duty rate.
export default {
  meta: {
    num: 29,
    slug: 'duty-free',
    title: 'Duty Free',
    tagline: '美国关税表里一条离谱具体的商品，猜它的进口税率。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '每天 3 条来自美国统一关税表（HTS）的商品条目，描述精确到令人发笑。',
      '用滑块或输入框猜它的一般税率（%）；很多条目其实是免税（0%）。',
      '每条最多 3 次机会，猜错会提示该调高还是调低，每多用一次扣 10%。',
    ],
    scoring: '按绝对误差计分：差 0 个百分点 100 分，差约 7 个百分点约 37 分；三条取平均。',
    sources: [{ name: 'USITC Harmonized Tariff Schedule (REST export)', url: 'https://hts.usitc.gov/reststop/exportList?from=0101&to=9999&format=JSON&styles=false', note: '只取一般税率（Column 1 General）为纯从价税或免税的 10 位条目' }],
    dataNote: '只收录“税率是单一百分比或 Free”的条目，含从量税、混合税的条目已剔除。税率为快照，不含近年额外加征的关税。',
  },

  puzzle({ data, rng }) {
    return { items: rng.sample(data.items, 3).map((x) => x.hts) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const by = new Map(ctx.data.items.map((x) => [x.hts, x]));
    const results = [];
    const rows = [];
    for (let i = 0; i < p.items.length; i++) {
      const it = by.get(p.items[i]);
      ctx.log('item', it.hts, it.rate);
      const body = ui.h('div', { class: 'ds-stack' },
        ui.quote(it.d),
        ui.h('div', { class: 'small muted mono' }, `HTS 章节 ${it.ch}`));
      const holder = ui.h('div');
      ctx.stage.append(holder);
      holder.append(ui.panel({ kicker: `第 ${i + 1} / ${p.items.length} 条`, title: '这件商品的进口税率是多少？' }, body));
      const r = await ctx.estimate({
        answer: it.rate, min: 0, max: 50, step: 0.5, initial: 5, scoring: 'abs', scale: 7,
        attempts: 3, tolerance: 0.5, container: holder, title: '你的猜测', format: (v) => `${v}%`,
      });
      results.push(r);
      rows.push({ hts: it.hts, rate: it.rate === 0 ? 'Free (0%)' : `${it.rate}%`, guess: `${r.guess}%`, d: it.d });
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, '线索：关税表按“章”分类，原料和机械多为免税或低税，纺织品、鞋、成衣、乳制品等敏感行业税率更高。上表是今天三条的实际税率。'),
      ui.table({ columns: [{ key: 'hts', label: 'HTS' }, { key: 'rate', label: '实际', num: true }, { key: 'guess', label: '你猜', num: true }, { key: 'd', label: '描述' }], rows }));
    return res;
  },
};
