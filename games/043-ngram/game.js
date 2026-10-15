import { cosine, pearson, pct, semState, trendText, whyText, peakNear, shapeFacts } from './lib.js';

export default {
  meta: {
    num: 43,
    slug: 'ngram',
    title: 'Ngram',
    tagline: '一个英文词在 1800–2019 年书籍里的词频曲线，猜出这个词。语义相似度会告诉你离答案多近。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '图上是某个英文单词在 Google Books 里 1800–2019 年逐年的相对词频（对数刻度，纵轴不标数值）。',
      '从列表里选一个词来猜，最多 6 次。每猜错一次解锁一条新线索。',
      '每次猜测会显示：与答案的语义相似度（GloVe 词向量余弦，≥60% 算接近）、两条曲线的相关系数（≥0.92 算接近）、该词自己的峰值年份（箭头指向答案峰值所在的方向，相差 10 年内算接近）。',
      '提示：战争、发明、潮流都会在曲线上留下形状——先想“什么事物在那一年冒出来”。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'Google Books Ngram Viewer (en-2019, smoothing 3)', url: 'https://books.google.com/ngrams' },
      { name: 'GloVe 50d (wiki+gigaword) 词向量，经 fse/glove-wiki-gigaword-50', url: 'https://huggingface.co/fse/glove-wiki-gigaword-50' },
    ],
    dataNote: '词表为 234 个手选英文词，其中曲线起伏足够大（峰谷相差 ≥ 20 倍）的 94 个会成为谜底。曲线为 Ngram 逐年值（API 自带 3 年平滑），取对数显示。语义相似度用 GloVe 50 维词向量的余弦值（离线预算，浏览器内没有大模型）。Ngram 接口没有 CORS 头，浏览器无法实时请求，所以是快照。',
  },

  puzzle({ data, pick }) {
    return { i: pick(data.answers) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const items = ctx.data.items;
    const ans = items[p.i];
    const byW = new Map(items.map((x) => [x.w, x]));
    const { y0, step } = ctx.data;
    const years = (it) => it.f.map((v, k) => ({ year: y0 + k * step, v }));
    const chart = (it, h = 220) => ui.plot((Plot, c) => ({
      height: h,
      x: { label: '年份', tickFormat: 'd' },
      y: { label: '相对词频（对数）', ticks: [], tickFormat: () => '' },
      marks: [Plot.areaY(years(it), { x: 'year', y: 'v', y1: Math.min(...it.f) - 0.2, fill: c.accent, fillOpacity: 0.15 }),
        Plot.lineY(years(it), { x: 'year', y: 'v', stroke: c.accent, strokeWidth: 2.5 })],
    }));
    ctx.log('answer', ans.w, 'peak', ans.peak);

    const clues = [
      ui.h('div', await chart(ans)),
      `${trendText(ans)} 峰值与谷底相差约 ${Math.round(10 ** ans.range)} 倍。`,
      `这个词有 ${ans.w.length} 个字母。`,
      `首字母是 “${ans.w[0].toUpperCase()}”。语义上相近的词里有：${ans.nn.slice(0, 2).join('、')}。`,
      `更多语义近邻：${ans.nn.join('、')}。`,
      `最后一个字母是 “${ans.w.at(-1)}”。`,
    ];
    const options = items.map((x) => ({ id: x.w, label: x.w }));
    const res = await ctx.guess({
      options,
      answer: ans.w,
      maxGuesses: 6,
      title: '这是哪个词？',
      placeholder: '输入英文单词…',
      clues,
      cluesTitle: '曲线和线索',
      columns: ['语义', '曲线', '峰值'],
      near: (g) => semState(cosine(byW.get(g.id).v, ans.v)) === 'near',
      feedback: (g) => {
        const it = byW.get(g.id);
        const c = cosine(it.v, ans.v), r = pearson(it.f, ans.f);
        ctx.log('guess', it.w, 'cos', c.toFixed(2), 'r', r.toFixed(2));
        const dy = it.peak - ans.peak;
        return [
          { text: pct(c), num: true, state: semState(c) },
          { text: r.toFixed(2), num: true, state: r > 0.92 ? 'near' : undefined },
          { text: `${it.peak} ${dy === 0 ? '✓' : dy < 0 ? '→' : '←'}`, num: true, state: peakNear(it.peak, ans.peak) ? 'near' : undefined },
        ];
      },
    });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案是 `, ui.h('b', ans.w), `。${whyText(ans, y0)}`),
      await chart(ans, 200),
      ui.kv([['语义近邻', ans.nn.join('、')], ['怎么推出来', shapeFacts(ans, y0).emerged ? '曲线有明显的“出生点”：词频从很低的水平陡升，那一年前后通常就是这个事物出现或流行的时候，再看顶点之后是否被新事物取代。' : '这是个老词，曲线从 1800 年起就有底；线索在于缓慢的升降——对应社会长期的变化，而不是某次发明。']]));
    return res;
  },
};
