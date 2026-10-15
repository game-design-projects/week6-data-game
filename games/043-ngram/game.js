import { cosine, pearson, pct, semState, trendText, whyText, peakNear, shapeFacts } from './lib.js';

export default {
  meta: {
    num: 43,
    slug: 'ngram',
    title: 'Ngram',
    tagline: 'An English word\'s frequency curve in books from 1800 to 2019. Guess the word; semantic similarity tells you how close you are.',
    category: 'words',
    data: 'snapshot',
    howTo: [
      'The chart shows how often an English word appeared in Google Books each year from 1800 to 2019 (log scale; the y-axis has no numbers).',
      'Pick a word from the list, up to 6 guesses. Each wrong guess unlocks a new clue.',
      'Each guess shows: its semantic similarity to the answer (cosine of GloVe word vectors; 60% or more counts as close), the correlation between the two curves (0.92 or more counts as close), and the guessed word\'s own peak year (the arrow points toward the answer\'s peak; within 10 years counts as close).',
      'Hint: wars, inventions and fashions all leave a shape on the curve. Ask what came into being around that year.',
    ],
    scoring: '100 points for a correct first guess, then about 17 fewer for each extra guess; 0 if you do not get it in 6.',
    sources: [
      { name: 'Google Books Ngram Viewer (en-2019, smoothing 3)', url: 'https://books.google.com/ngrams' },
      { name: 'GloVe 50d (wiki+gigaword) word vectors, via fse/glove-wiki-gigaword-50', url: 'https://huggingface.co/fse/glove-wiki-gigaword-50' },
    ],
    dataNote: 'The vocabulary is 234 hand-picked English words; the 94 whose curves swing enough (peak at least 20× the trough) can become answers. Curves are yearly Ngram values (the API applies 3-year smoothing), shown on a log scale. Semantic similarity is the cosine of GloVe 50-dimensional word vectors, precomputed offline (there is no large model in the browser). The Ngram API sends no CORS headers, so the browser cannot call it live; this is a snapshot.',
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
      x: { label: 'Year', tickFormat: 'd' },
      y: { label: 'Relative frequency (log)', ticks: [], tickFormat: () => '' },
      marks: [Plot.areaY(years(it), { x: 'year', y: 'v', y1: Math.min(...it.f) - 0.2, fill: c.accent, fillOpacity: 0.15 }),
        Plot.lineY(years(it), { x: 'year', y: 'v', stroke: c.accent, strokeWidth: 2.5 })],
    }));
    ctx.log('answer', ans.w, 'peak', ans.peak);

    const clues = [
      ui.h('div', await chart(ans)),
      `${trendText(ans)} Peak and trough differ by about ${Math.round(10 ** ans.range)}×.`,
      `The word has ${ans.w.length} letters.`,
      `It starts with "${ans.w[0].toUpperCase()}". Words close in meaning include: ${ans.nn.slice(0, 2).join(', ')}.`,
      `More semantic neighbors: ${ans.nn.join(', ')}.`,
      `The last letter is "${ans.w.at(-1)}".`,
    ];
    const options = items.map((x) => ({ id: x.w, label: x.w }));
    const res = await ctx.guess({
      options,
      answer: ans.w,
      maxGuesses: 6,
      title: 'Which word is it?',
      placeholder: 'Type a word…',
      clues,
      cluesTitle: 'Curve and clues',
      columns: ['Meaning', 'Curve', 'Peak'],
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
      ui.h('div', { class: 'ink2' }, `The answer is `, ui.h('b', ans.w), `. ${whyText(ans, y0)}`),
      await chart(ans, 200),
      ui.kv([['Semantic neighbors', ans.nn.join(', ')], ['How to work it out', shapeFacts(ans, y0).emerged ? 'The curve has a clear "birth point": the frequency shoots up from a very low level, and that year is usually when the thing appeared or became popular. Then see whether it was replaced by something newer after the peak.' : 'This is an old word with a solid floor since 1800. The clue is in the slow rises and falls, which track long social change rather than one invention.']]));
    return res;
  },
};
