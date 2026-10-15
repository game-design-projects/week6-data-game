// #55 Palette — five dominant colours of a painting; guess its year and movement.
export const decade = (y) => `${Math.floor(y / 10) * 10}s`;
export const YEAR_MIN = 1400, YEAR_MAX = 1940;

/** Four movement options. Distractors are movements whose usual period (+-10 y) does not contain the painting's
 *  year, so the year estimate and the movement question reinforce each other instead of being a coin flip. */
export const styleOptions = (styles, answerId, year, rng) => {
  const ans = styles.find((s) => s.id === answerId);
  const others = styles.filter((s) => s.id !== answerId);
  const far = others.filter((s) => year < s.from - 10 || year > s.to + 10);
  const pool = far.length >= 3 ? far : others;
  return rng.shuffle([ans, ...rng.sample(pool, 3)]);
};

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
/** Share-weighted mean lightness and saturation (HSL, 0..1) of a palette. */
export const paletteStats = (colors, share) => {
  let L = 0, S = 0, W = 0;
  colors.forEach((c, i) => {
    const [r, g, b] = rgb(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
    L += l * share[i]; S += sat * share[i]; W += share[i];
  });
  return { light: L / W, sat: S / W };
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const pc = (v) => `${Math.round(v * 100)}%`;
const tone = (d) => (d > 0.04 ? 1 : d < -0.04 ? -1 : 0);

/** Puzzle-specific explanation: how this palette compares with the rest of the pool. */
export const explain = (p, paintings, style) => {
  const st = paletteStats(p.colors, p.share);
  const same = paintings.filter((q) => q.style === p.style && q.id !== p.id).map((q) => paletteStats(q.colors, q.share));
  const all = paintings.filter((q) => q.id !== p.id).map((q) => paletteStats(q.colors, q.share));
  const ref = same.length >= 2 ? same : all;
  const refName = same.length >= 2 ? `同为${style.zh}的画作` : '全部画作';
  const dl = st.light - mean(ref.map((x) => x.light)), ds = st.sat - mean(ref.map((x) => x.sat));
  const parts = [];
  if (tone(dl)) parts.push(`整体${dl > 0 ? '更亮' : '更暗'}`);
  if (tone(ds)) parts.push(`饱和度${ds > 0 ? '更高' : '更低'}`);
  return {
    stats: `平均明度 ${pc(st.light)}、平均饱和度 ${pc(st.sat)}；${refName}平均为 ${pc(mean(ref.map((x) => x.light)))} / ${pc(mean(ref.map((x) => x.sat)))}`
      + (parts.length ? `，这幅${parts.join('、')}。` : '，非常典型。'),
  };
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
      '先估计作品的创作年份：暗沉的土褐与深色背景多见于旧画，高饱和的纯色与大块平涂偏近代，金色多见于早期。',
      '再从四个流派中选一个（干扰项的流派盛行期都和这幅画的年代不重合）。猜完后会揭晓原画，并对比它的明度、饱和度与同流派画作。',
      '计分：年份满分 100，每差 40 年降到约三分之一（差 1 年约 98 分，差 100 年约 8 分）；流派答对 100 分；两项相加满分 200。',
    ],
    scoring: '年份 100 × e^(−误差/40 年)，范围 1400–1940 年；流派对 100 / 错 0；两项相加，满分 200。',
    sources: [
      { name: 'Art Institute of Chicago API（公有领域画作，CC0 元数据）', url: 'https://api.artic.edu/docs/' },
      { name: 'AIC IIIF 图像服务', url: 'https://api.artic.edu/docs/#iiif-image-api', note: '缩略图用于离线提取主色并嵌入页面' },
    ],
    dataNote: '主色由离线 k-means（48×48 缩略图，RGB 空间）从真实画作图像计算。流派取自芝加哥艺术博物馆的 style 字段，仅选取明确的艺术流派/传统（排除只写世纪的条目），并剔除年份落在该流派通行时期之外的条目（标签多为馆方笼统归类）。年份取馆藏记录日期区间的中点，仅保留区间不超过 12 年的作品。博物馆接口虽允许跨域，但图像服务禁止网页热链，因此不做实时抓取，数据为离线快照。',
  },

  puzzle({ data, rng, pick }) {
    const p = pick(data.paintings);
    return { p, options: styleOptions(data.styles, p.style, p.year, rng) };
  },

  async play(ctx, { p, options }) {
    const { ui, core } = ctx;
    ctx.log('painting', p.id, p.year, p.style);
    const bar = ui.h('div', { style: { display: 'flex', height: '110px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--rule)' } },
      p.colors.map((c, i) => ui.h('div', { title: `${c} ${Math.round(p.share[i] * 100)}%`, style: { flex: String(Math.max(p.share[i], 0.04)), background: c } })));
    const chips = ui.h('div', { class: 'ds-row small mono', style: { marginTop: '10px', gap: '12px', flexWrap: 'wrap' } },
      p.colors.map((c, i) => ui.h('span', ui.h('span', { style: { color: c, textShadow: '0 0 1px var(--ink)' } }, '■'), ` ${c} ${Math.round(p.share[i] * 100)}%`)));
    ctx.stage.append(ui.panel({ kicker: '五个主色', title: '这幅画的调色板' }, bar, chips));

    const yr = await ctx.estimate({
      title: '画于哪一年？', answer: p.year, min: YEAR_MIN, max: YEAR_MAX, step: 1, initial: 1750,
      format: (v) => `${Math.round(v)} 年`, scoring: 'abs', scale: 40,
    });
    ctx.log('year', yr.guess);
    const st = await ctx.rounds({
      rounds: [{ prompt: '它属于哪个流派？', options: options.map((o) => ({ label: o.zh, sub: o.id })), correct: options.findIndex((o) => o.id === p.style) }],
    });
    const res = ctx.combine([yr, { ...st, score: st.score * 100, max: 100 }]);
    const style = ctx.data.styles.find((s) => s.id === p.style);
    const ex = explain(p, ctx.data.paintings, style);
    const off = Math.round(Math.abs(yr.guess - p.year));
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('img', { src: p.thumb, alt: '本题画作', style: { width: '160px', maxWidth: '100%', borderRadius: '8px' } }),
      ui.kv([
        ['作品', p.title], ['艺术家', p.artist],
        ['年份', `${p.year}（你猜 ${Math.round(yr.guess)}，差 ${off} 年）`],
        ['流派', `${style.zh} ${p.style}`],
        ['流派特征', style.note],
        ['这幅的色板', ex.stats],
        ['最大色块', `${p.colors[0]} 占 ${core.fmtPct ? core.fmtPct(p.share[0]) : Math.round(p.share[0] * 100) + '%'}`],
      ]),
      ui.h('div', { class: 'small muted' }, '缩略图：Art Institute of Chicago，公有领域。'));
    return res;
  },
};
