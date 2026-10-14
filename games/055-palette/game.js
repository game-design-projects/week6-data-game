// #55 Palette — five dominant colours of a painting; guess its year and movement.
export const decade = (y) => `${Math.floor(y / 10) * 10}s`;
/** Movement question is right only for the exact style id. */
export const styleOptions = (styles, answerId, rng) => {
  const others = rng.sample(styles.filter((s) => s.id !== answerId), 3);
  return rng.shuffle([styles.find((s) => s.id === answerId), ...others]);
};

export default {
  meta: {
    num: 55,
    slug: 'palette',
    title: 'Palette',
    tagline: '一幅名画被压缩成五种主色。凭色彩猜它画于哪一年、属于哪个流派。',
    category: 'culture',
    data: 'computed',
    howTo: [
      '色条的宽度代表这种颜色在画面中所占的比例，五种颜色是对整幅画做 k-means 聚类得到的。',
      '先估计作品的创作年份：土褐与暗绿偏旧画，高饱和与粉彩偏近代，大面积金色多见于早期。',
      '再从四个流派中选一个。猜完后会揭晓原画，对照色板看看规律。',
      '计分：年份满分 100，每差约 40 年降到约三分之一；流派答对 100 分；两项相加满分 200。',
    ],
    scoring: '年份 100 × e^(−误差/40 年)；流派对 100 / 错 0；两项相加，满分 200。',
    sources: [
      { name: 'Art Institute of Chicago API（公有领域画作，CC0 元数据）', url: 'https://api.artic.edu/docs/' },
      { name: 'AIC IIIF 图像服务', url: 'https://api.artic.edu/docs/#iiif-image-api', note: '缩略图用于离线提取主色，结果页热链原图' },
    ],
    dataNote: '主色由离线 k-means（48×48 缩略图，RGB 空间）从真实画作图像计算。流派取自芝加哥艺术博物馆的 style 字段，仅选取明确的艺术流派/传统（排除只写世纪的条目）。',
  },

  puzzle({ data, rng, pick }) {
    const p = pick(data.paintings);
    return { p, options: styleOptions(data.styles, p.style, rng) };
  },

  async play(ctx, { p, options }) {
    const { ui, core } = ctx;
    ctx.log('painting', p.id, p.year, p.style);
    const bar = ui.h('div', { style: { display: 'flex', height: '110px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--rule)' } },
      p.colors.map((c, i) => ui.h('div', { title: c, style: { flex: String(Math.max(p.share[i], 0.04)), background: c } })));
    const chips = ui.h('div', { class: 'ds-row small mono', style: { marginTop: '10px', gap: '12px', flexWrap: 'wrap' } },
      p.colors.map((c, i) => ui.h('span', ui.h('span', { style: { color: c, textShadow: '0 0 1px var(--ink)' } }, '■'), ` ${c} ${Math.round(p.share[i] * 100)}%`)));
    ctx.stage.append(ui.panel({ kicker: '五个主色', title: '这幅画的调色板' }, bar, chips));

    const yr = await ctx.estimate({
      title: '画于哪一年？', answer: p.year, min: 1300, max: 1960, step: 1, initial: 1750,
      format: (v) => `${Math.round(v)} 年`, scoring: 'abs', scale: 40,
    });
    ctx.log('year', yr.guess);
    const st = await ctx.rounds({
      rounds: [{ prompt: '它属于哪个流派？', options: options.map((o) => ({ label: o.zh, sub: o.id })), correct: options.findIndex((o) => o.id === p.style) }],
    });
    const res = ctx.combine([yr, { ...st, score: st.score * 100, max: 100 }]);
    const zh = ctx.data.styles.find((s) => s.id === p.style).zh;
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('img', { src: p.thumb, alt: p.title, style: { width: '160px', maxWidth: '100%', borderRadius: '8px' } }),
      ui.kv([
        ['作品', `${p.title}`], ['艺术家', p.artist], ['年份', `${p.year}（你猜 ${Math.round(yr.guess)}，${decade(p.year)}）`],
        ['流派', `${zh} ${p.style}`],
        ['色板规律', `最大色块 ${p.colors[0]} 占 ${core.fmtPct ? core.fmtPct(p.share[0]) : Math.round(p.share[0] * 100) + '%'}；对照看看暗调与饱和度如何随时代变化。`],
      ]),
      ui.h('div', { class: 'small muted' }, '缩略图：Art Institute of Chicago，公有领域。'));
    return res;
  },
};
