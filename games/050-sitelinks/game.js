// #50 Sitelinks — how many Wikipedia language editions cover a topic?
const LANG_ZH = { en: 'English', de: 'German', fr: 'French', es: 'Spanish', ru: 'Russian', ja: 'Japanese', zh: 'Chinese', it: 'Italian', pt: 'Portuguese', ar: 'Arabic' };

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
  if (n >= 200) return 'Worldwide fame: nearly every major language, and many small ones, has an article.';
  if (n >= 100) return 'Internationally known: well over a hundred editions thought it worth writing.';
  if (n >= 60) return 'Known across regions: almost all major languages cover it, while smaller ones start to drop out.';
  if (n >= 30) return 'Regionally known: big European or Asian languages have it, most small ones do not.';
  return 'A local topic: only a few languages have written it up, mostly tied to one place or community.';
}

/** Puzzle-specific explanation: which of the 10 biggest Wikipedias cover the item. */
export function explain(it) {
  const miss = it.miss || [];
  const head = `“${it.name}” has articles in ${it.n} language editions of Wikipedia`;
  if (!miss.length) return `${head} (about ${Math.round((it.n / TOTAL) * 100)}% of all editions), including all 10 of the largest Wikipedias. ${tier(it.n)}`;
  const names = miss.map((c) => LANG_ZH[c] || c).join(', ');
  if (miss.length >= 6) return `${head}, but ${miss.length} of the 10 largest Wikipedias lack it (${names}). Even big languages skipped it, so the topic is known only in a small circle.`;
  return `${head}; the 10 largest Wikipedias are missing it in ${names}. ${tier(it.n)}`;
}

const TOTAL = 340; // approx. number of Wikipedia language editions
const fmt = (v) => `${Math.round(v)} editions`;

export default {
  meta: {
    num: 50,
    slug: 'sitelinks',
    title: 'Sitelinks',
    tagline: 'How many languages of Wikipedia cover a topic? Rank 5 topics, then estimate one number.',
    category: 'words',
    data: 'snapshot',
    howTo: [
      'Today you get 5 topics of one kind (cities, films, chemical elements...). Rank them by how many language editions of Wikipedia have an article on them, most to fewest. You have up to 3 tries, and each one only tells you how many positions are right.',
      'Then estimate the edition count for one more topic from a different category. The slider is logarithmic: off by 2x scores about 37 points, off by 20% about 77.',
      'Only Wikipedia language editions count (about 340 in all), not sister projects such as Commons or Wikiquote.',
      'Rule of thumb: global topics have 200+ languages, topics only a nation knows usually have thirty or forty, and whether the 10 largest Wikipedias all cover it is a great clue.',
    ],
    scoring: 'Ranking 100 points (by correct positions, retries cost points), estimate 100 points (log error, off by 2x is about 37), 200 in total.',
    sources: [
      { name: 'Wikidata API (wbgetentities, sitelinks)', url: 'https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities', note: 'CC0' },
      { name: 'Wikidata Query Service (candidate items)', url: 'https://query.wikidata.org/', note: 'CC0' },
    ],
    dataNote: 'A Wikidata snapshot (see the fetched date in data.json): for each category, items with many language editions are sampled at random, and for each we count the sites ending in "wiki" (dropping non-encyclopedia sites such as Commons, Species and Meta). Edition counts creep up over time. The Wikidata API allows cross-origin calls, but today\'s puzzle needs no live data, so a fixed snapshot keeps everyone on the same puzzle. Names and descriptions are the English originals.',
  },

  puzzle({ data, rng, pick }) {
    const cat = pick(data.cats);
    const items = spread(cat.items, 5, rng);
    // estimate target: an item from a DIFFERENT category, so the ranking reveal cannot leak its count
    const other = rng.pick(data.cats.filter((c) => c.key !== cat.key));
    const target = rng.pick(other.items);
    return { cat: cat.label, items, tcat: other.label, target };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('sitelinks puzzle', p.cat, p.items.map((i) => `${i.name}=${i.n}`).join(', '), '| target', p.target.name, p.target.n);
    const sub = (i) => i.desc || '';
    const r1 = await ctx.order({
      title: `Ranking: which of these 5 ${p.cat} has the most language editions?`,
      prompt: 'Order from most to fewest (drag or use ↑↓). Counts are Wikipedia language editions.',
      items: p.items.map((i) => ({ id: i.id, label: i.name, sub: sub(i), value: i.n })),
      direction: 'desc',
      attempts: 3,
      format: fmt,
    });
    const t = p.target;
    const r2 = await ctx.estimate({
      title: `Estimate: how many language editions cover “${t.name}”?`,
      prompt: `${p.tcat[0].toUpperCase() + p.tcat.slice(1)}: ${sub(t)}`,
      answer: t.n, min: 10, max: 400, log: true, step: 1, initial: 60,
      format: fmt, scoring: 'log', scale: 0.3,
    });
    const res = ctx.combine([r1, r2]);
    const sorted = p.items.slice().sort((a, b) => b.n - a.n);
    const hi = sorted[0], lo = sorted[sorted.length - 1];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [{ key: 'name', label: p.cat[0].toUpperCase() + p.cat.slice(1) }, { key: 'n', label: 'Editions', num: true }, { key: 'miss', label: 'Share of all', num: true, fmt: (_, r) => `${Math.round((r.n / TOTAL) * 100)}%` }],
        rows: sorted,
      }),
      ui.callout(`Ranking clue: ${hi.name} has ${hi.n} editions, ${lo.name} only ${lo.n}, a ${(hi.n / lo.n).toFixed(1)}x gap. ${explain(hi)}`),
      ui.callout(`Estimate answer: ${explain(t)}`),
      ui.h('div', { class: 'small muted' }, 'Tip: whether a topic travels across cultures predicts its language count better than its sheer size.'));
    return res;
  },
};
