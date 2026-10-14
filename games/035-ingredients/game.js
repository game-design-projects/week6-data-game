// #35 Ingredients — the ingredient list is revealed from the smallest share upwards; guess the product.

/** How many of the smallest ingredients are visible at each of `stages` clue levels. */
export function revealCounts(n, stages = 6) {
  const first = Math.min(3, n);
  return Array.from({ length: stages }, (_, k) => Math.min(n, first + Math.ceil(((n - first) * k) / (stages - 1))));
}

/** Hide product / brand words that appear inside an ingredient name. */
export function redactName(text, product) {
  const words = `${product.brand} ${product.name}`.split(/[^A-Za-z]+/).filter((w) => w.length > 3);
  let out = text;
  for (const w of words) out = out.replace(new RegExp(w, 'gi'), '▇▇▇');
  return out;
}

export default {
  meta: {
    num: 35,
    slug: 'ingredients',
    title: 'Ingredients',
    tagline: '配料表按占比从小到大一条条揭示，猜这是哪款食品。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '食品配料表是按含量从多到少排的。游戏反过来：先只给你看含量最少的几种成分。',
      '从列表里选一款食品来猜，最多 6 次。每猜错一次，揭示更多、更靠前的成分。',
      '每次猜测会告诉你品类对不对、成分种类数比答案多还是少。',
      '提示：微量的乳化剂、香精、E 编号往往是品牌的“指纹”。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'Open Food Facts product API', url: 'https://world.openfoodfacts.org/api/v2/product/3017620422003.json', note: '配料与含量估计来自社区录入的包装信息' },
      { name: 'Open Food Facts search-a-licious', url: 'https://search.openfoodfacts.org/' },
    ],
    dataNote: '每个商品取 Open Food Facts 上扫码次数最多的条目，用其结构化的顶层配料列表（英文分类标识）。含量百分比是 OFF 的估算值，并非包装标注；不同国家的配方可能不同。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.products).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const all = ctx.data.products;
    const byId = new Map(all.map((x) => [x.id, x]));
    const ans = byId.get(p.id);
    const N = ans.ing.length;
    const counts = revealCounts(N);
    const rev = ans.ing.slice().reverse(); // smallest first
    ctx.log('ingredients puzzle', ans.name, N, counts);

    const list = (from, to, start) => ui.h('ol', { start: start + 1, style: { margin: '4px 0 0', paddingLeft: '1.6em' } },
      rev.slice(from, to).map((x) => ui.h('li', redactName(x[0], ans))));
    const clues = counts.map((c, k) => {
      const from = k ? counts[k - 1] : 0;
      if (c === from) return `配料表只有 ${N} 种成分，已经全部揭示。`;
      return ui.h('div',
        k === 0 ? `这款食品共有 ${N} 种成分。含量最少的 ${c} 种（由少到多）：` : `再多一点的 ${c - from} 种：`,
        list(from, c, from));
    });

    const options = all.map((x) => ({ id: x.id, label: x.name, hint: x.brand, aliases: [x.brand] }));
    const res = await ctx.guess({
      options, answer: ans.id, maxGuesses: 6, title: '这是什么食品？', placeholder: '输入名称（中文或品牌）…',
      clues, cluesTitle: '配料表（从最少开始）', columns: ['品类', '成分数'],
      near: (g, a) => byId.get(g.id).cat === byId.get(a.id).cat,
      feedback: (g) => {
        const gp = byId.get(g.id);
        const d = gp.ing.length - N;
        return [
          { text: gp.cat, state: gp.cat === ans.cat ? 'hit' : undefined },
          { text: d === 0 ? `${N}` : `${gp.ing.length} ${d > 0 ? '↓' : '↑'}`, num: true, state: d === 0 ? 'hit' : Math.abs(d) <= 2 ? 'near' : undefined },
        ];
      },
    });

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${ans.name}（${ans.brand}）。配料表按含量从多到少共 ${N} 种，百分比为 OFF 估算值：`),
      ui.table({ columns: [{ key: 'n', label: '成分' }, { key: 'p', label: '占比 %', num: true }], rows: ans.ing.map(([n, pc]) => ({ n, p: pc })) }),
      ui.h('div', { class: 'small muted' }, `条形码 ${ans.code}。小提示：靠后的成分（乳化剂、香精、色素）常常比前几位的大宗原料更能认出品牌。`));
    return res;
  },
};
