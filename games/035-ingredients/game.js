// #35 Ingredients — the ingredient list is revealed from the smallest share upwards; guess the product.

export const MAX_GUESSES = 6;

/** Ingredients too common/vague to identify a product on their own. */
export const GENERIC = new Set(['sugar', 'salt', 'water', 'flavouring', 'natural-flavouring', 'artificial-flavouring', 'colour', 'acid', 'acidity-regulator', 'preservative', 'sweetener', 'emulsifier', 'vitamins', 'minerals', 'carbonated-water', 'thickener', 'stabiliser', 'antioxidant', 'flavour-enhancer', 'spice', 'natural-and-artificial-flavouring']);

/**
 * How many of the smallest ingredients are visible at each clue stage.
 * Stage 1 shows `first` (1–3) ingredients; every later stage adds at least one,
 * and the last stage always shows the whole list.
 */
export function revealCounts(n, stages = MAX_GUESSES) {
  const first = Math.max(1, Math.min(3, n - (stages - 1)));
  const rest = n - first;
  return Array.from({ length: stages }, (_, k) => (k === stages - 1 ? n : first + Math.floor((rest * k) / (stages - 1))));
}

/** Ingredient ids (rarest-first) of `prod` with document frequency across the pool. */
export function distinctive(prod, products, top = 3) {
  const df = new Map();
  for (const p of products) for (const id of new Set(p.ing)) df.set(id, (df.get(id) ?? 0) + 1);
  return [...new Set(prod.ing)]
    .filter((id) => !GENERIC.has(id))
    .map((id) => ({ id, df: df.get(id), pos: prod.ing.length - prod.ing.indexOf(id) }))
    .sort((a, b) => a.df - b.df || b.pos - a.pos)
    .slice(0, top);
}

/** How many of the guessed product's ingredients also appear in the answer. */
export function sharedCount(guess, answer) {
  const a = new Set(answer.ing);
  return [...new Set(guess.ing)].filter((id) => a.has(id)).length;
}

export default {
  meta: {
    num: 35,
    slug: 'ingredients',
    title: 'Ingredients',
    tagline: '配料表倒着揭示：先看含量最少的成分，猜这是哪款食品。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '食品包装上的配料表按含量从多到少排列。游戏把它倒过来：先只给你看排在最末、含量最少的几种成分。',
      '从列表里选一款食品来猜，最多 6 次。每猜错一次，就多揭示一批更靠前（含量更多）的成分，第 6 条线索会给出完整配料表。',
      '每次猜测会反馈：品类是否相同、成分种类数比答案多还是少、以及和答案共有多少种成分。',
      '提示：不起眼的乳化剂、E 编号、香精，往往是配方的“指纹”。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分（第 6 次 17 分），6 次都没猜中 0 分。',
    sources: [
      { name: 'Open Food Facts 产品 API', url: 'https://world.openfoodfacts.org/api/v2/product/3017620422003.json', note: '每款食品的结构化配料表（社区录入的包装信息，ODbL 授权）' },
      { name: 'Open Food Facts search-a-licious', url: 'https://search.openfoodfacts.org/', note: '用于查找条形码' },
    ],
    dataNote: '每款食品取 Open Food Facts 上扫码次数最多、配料表可被完整解析的条目，只保留包装上的顶层配料（括号里的子成分不计），顺序即包装标注的含量由多到少。成分名称由 OFF 的英文标准词条人工译为中文，括号内为原词。不同国家的同名食品配方可能不同，答案以该条目为准。此数据为快照，不是实时数据。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.products).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const all = ctx.data.products;
    const dict = ctx.data.dict;
    const byId = new Map(all.map((x) => [x.id, x]));
    const ans = byId.get(p.id);
    const N = ans.ing.length;
    const counts = revealCounts(N);
    const rev = ans.ing.slice().reverse(); // smallest first
    ctx.log('ingredients puzzle', ans.name, N, counts);

    const nameNode = (id) => {
      const [zh, en] = dict[id];
      return ui.h('span', zh, zh !== en ? ui.h('span', { class: 'muted small' }, ` ${en}`) : null);
    };
    const list = (from, to) => ui.h('ol', { start: from + 1, style: { margin: '4px 0 0', paddingLeft: '1.6em' } },
      rev.slice(from, to).map((id) => ui.h('li', nameNode(id))));
    const clues = counts.map((c, k) => {
      const from = k ? counts[k - 1] : 0;
      const head = k === 0
        ? `这款食品共有 ${N} 种成分。含量最少的 ${c} 种（由少到多）：`
        : k === counts.length - 1 ? `最后 ${c - from} 种，也是含量最多的——完整配料表：` : `再多一点的 ${c - from} 种：`;
      return ui.h('div', head, list(from, c));
    });

    const options = all.map((x) => ({ id: x.id, label: x.name, hint: x.brand, aliases: [x.brand] }));
    let used = 0;
    const res = await ctx.guess({
      options, answer: ans.id, maxGuesses: MAX_GUESSES, title: '这是什么食品？', placeholder: '输入名称（中文或英文品牌）…',
      clues, cluesTitle: '配料表（从含量最少的开始）', columns: ['品类', '成分数', '共有成分'],
      near: (g, a) => byId.get(g.id).cat === byId.get(a.id).cat,
      onGuess: () => { used++; },
      feedback: (g) => {
        const gp = byId.get(g.id);
        const d = gp.ing.length - N;
        const sh = sharedCount(gp, ans);
        return [
          { text: gp.cat, state: gp.cat === ans.cat ? 'hit' : undefined },
          { text: d === 0 ? `${N}` : `${gp.ing.length} ${d > 0 ? '↓' : '↑'}`, num: true, state: d === 0 ? 'hit' : Math.abs(d) <= 2 ? 'near' : undefined },
          { text: `${sh}/${new Set(gp.ing).size}`, num: true, state: sh === new Set(gp.ing).size && sh === new Set(ans.ing).size ? 'hit' : sh / new Set(gp.ing).size >= 0.5 ? 'near' : undefined, title: '猜测的成分里有几种也出现在答案中' },
        ];
      },
    });

    // Learnable: what in the list gave it away, specific to this product.
    const tells = distinctive(ans, all, 3);
    const seenAt = (id) => counts.findIndex((c) => rev.indexOf(id) < c) + 1;
    const tellText = tells.map((t) => {
      const others = all.filter((x) => x.id !== ans.id && x.ing.includes(t.id)).map((x) => x.name);
      const rare = t.df === 1 ? `题库 ${all.length} 款里只有它含有` : `题库 ${all.length} 款里只有 ${t.df} 款含有（${others.slice(0, 2).join('、')}${t.df > 3 ? ' 等' : ''}和它自己）`;
      return ui.h('li', ui.h('b', dict[t.id][0]), `：${rare}，排在含量倒数第 ${rev.indexOf(t.id) + 1} 位（第 ${seenAt(t.id)} 条线索）。`);
    });
    const shown = counts[Math.max(1, Math.min(used, MAX_GUESSES)) - 1];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${ans.name}（${ans.brand}），属于「${ans.cat}」，包装配料共 ${N} 种。`),
      ui.h('div', null, ui.h('b', '最能认出它的成分'), ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.4em' } }, tellText)),
      ui.h('div', null, ui.h('b', '完整配料表（含量由多到少）'),
        ui.h('ol', { style: { margin: '4px 0 0', paddingLeft: '1.6em' } },
          ans.ing.map((id, i) => ui.h('li', { style: { opacity: ans.ing.length - i <= shown ? 1 : 0.6 } }, nameNode(id))))),
      ui.h('div', { class: 'small muted' }, `你看到了最末的 ${Math.min(shown, N)} 种。靠后的成分（乳化剂、香精、色素、维生素预混料）往往比前几位的大宗原料更能认出品牌。`),
      ui.h('div', { class: 'small muted' }, '条形码 ', ui.h('a', { href: `https://world.openfoodfacts.org/product/${ans.code}`, target: '_blank', rel: 'noopener' }, ans.code), '（Open Food Facts）'));
    return res;
  },
};
