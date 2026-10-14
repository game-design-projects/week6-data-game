// #21 Year Built — three Wikidata/Commons photos of NYC buildings; guess the year each was built.
export const yearScore = (guess, answer) => Math.exp(-Math.abs(guess - answer) / 30);

const thumb = (f) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=640`;

export default {
  meta: {
    num: 21,
    slug: 'year-built',
    title: 'Year Built',
    tagline: '一张纽约建筑的照片，猜它是哪一年建成的。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '每天三栋纽约建筑的照片，名字先藏起来，只告诉你所在的大致位置。',
      '看窗户、材料、装饰和轮廓，拖动滑块或输入建成年份。',
      '计分：误差 0 年 100 分，误差 30 年约 37 分，三栋取平均。',
    ],
    scoring: '每栋 100·e^(−误差/30)，三栋合计。',
    sources: [
      { name: 'Wikidata（建成年份 P571、坐标、图片）', url: 'https://query.wikidata.org/' },
      { name: 'Wikimedia Commons（照片与授权）', url: 'https://commons.wikimedia.org/' },
    ],
    dataNote: '原想法用 Mapillary 街景 + PLUTO；Mapillary 需要 API key，所以改用 Wikidata 中带照片和建成年份的纽约建筑（约 150 栋）。部分年份可能是落成/启用年份。',
  },

  puzzle({ data, rng }) {
    const picked = rng.sample(data.items, 3);
    return { ids: picked.map((b) => b.id) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const results = [];
    for (let i = 0; i < p.ids.length; i++) {
      const b = ctx.data.items.find((x) => x.id === p.ids[i]);
      ctx.log('round', i + 1, b.name, b.year);
      const img = ui.h('img', { src: thumb(b.file), alt: '建筑照片', style: { width: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: 'var(--radius, 8px)', background: 'var(--paper2)' } });
      const panel = ui.panel({ kicker: `第 ${i + 1} / ${p.ids.length} 栋`, title: '这栋楼哪年建成？' }, img,
        ui.h('div', { class: 'small muted mono' }, `📍 ${b.lat.toFixed(3)}, ${b.lng.toFixed(3)}`));
      ctx.stage.append(panel);
      const r = await ctx.estimate({
        answer: b.year, min: 1700, max: 2025, step: 1, initial: 1900, format: (v) => String(Math.round(v)),
        scoring: yearScore, title: '建成年份', prompt: '拖动滑块或直接输入年份。',
      });
      r.detail = ui.h('div', { class: 'ds-stack' },
        ui.kv([['建筑', b.name], ['建成', `${b.year} 年`], ['你猜', `${Math.round(r.guess)} 年（差 ${Math.abs(Math.round(r.guess) - b.year)} 年）`], ['照片', `${b.author} · ${b.lic}`]]),
        ui.h('div', { class: 'small ink2' }, b.year < 1860 ? '线索：砖石承重墙、小窗和对称立面多见于 19 世纪中期之前。' : b.year < 1930 ? '线索：石灰岩/红砖立面和繁复装饰常见于 1880–1930。' : b.year < 1975 ? '线索：玻璃幕墙和简洁几何出现在战后现代主义时期。' : '线索：后现代与当代建筑用大面积玻璃和不规则体量。'));
      results.push(r);
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' }, results.map((r) => r.detail));
    return res;
  },
};
