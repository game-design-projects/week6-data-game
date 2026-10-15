// #35 Ingredients — the ingredient list is revealed from the smallest share upwards; guess the product.

export const MAX_GUESSES = 6;

/** Ingredients too common/vague to identify a product on their own. */
export const GENERIC = new Set(['sugar', 'salt', 'water', 'flavouring', 'natural-flavouring', 'artificial-flavouring', 'colour', 'acid', 'acidity-regulator', 'preservative', 'sweetener', 'emulsifier', 'vitamins', 'minerals', 'carbonated-water', 'thickener', 'stabiliser', 'antioxidant', 'flavour-enhancer', 'spice', 'natural-and-artificial-flavouring']);

/** Words in a product title that only name the kind of food; they are not brand words, so they may appear in ingredient names. */
export const DESCRIPTOR_WORDS = new Set(['peanut', 'sauce', 'mustard', 'cheese', 'chicken', 'beans', 'baked', 'cereal', 'pasta', 'yogurt', 'mayonnaise', 'jam', 'preserves', 'popcorn', 'cream', 'ice', 'milk', 'chocolate', 'classic', 'original', 'crackers', 'biscuits', 'chips', 'soup', 'drink', 'juice', 'tea', 'iced', 'oat', 'soya', 'root', 'beer', 'vegetable', 'nacho', 'cheddar', 'oyster', 'stock', 'cube', 'soda', 'waffles', 'smoothie', 'cake', 'mix', 'coffee', 'gum', 'extra', 'taco', 'shells', 'pickle', 'spread', 'ready', 'salted', 'tonic', 'water', 'worcestershire', 'vanilla', 'crunchy', 'cups', 'bar', 'nut', 'mini', 'corner', 'kisses', 'gummy', 'bears', 'goldbears', 'singles', 'dijon', 'zero', 'hot', 'dark', 'excellence']);

/** Lower-case brand words (> 3 letters) of a product that must not show up inside an ingredient name. */
export function brandWords(title, brands = '') {
  return `${title} ${brands}`.split(/[^A-Za-z]+/).filter((w) => w.length > 3).map((w) => w.toLowerCase()).filter((w) => !DESCRIPTOR_WORDS.has(w));
}

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

const ordinal = (n) => (n === 1 ? 'last' : `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 < 4 ? n % 10 : 0]}-to-last`);

export default {
  meta: {
    num: 35,
    slug: 'ingredients',
    title: 'Ingredients',
    tagline: 'The label read backwards: start with the tiniest ingredients and name the food.',
    category: 'science',
    data: 'snapshot',
    howTo: [
      'Ingredient lists run from the largest share to the smallest. Here they run backwards: you start with only the last, tiniest few.',
      'Pick a product from the list, up to 6 guesses. Each miss reveals another batch of ingredients, moving up toward the biggest. Clue 6 shows the full list.',
      'Every guess gets feedback: same category or not, whether it has more or fewer ingredients than the answer, and how many ingredients they share.',
      'Tip: emulsifiers, E-numbers and flavourings are a recipe\u2019s fingerprint.',
    ],
    scoring: 'Right on guess 1 is 100 points, then about 17 fewer for each extra guess (17 on guess 6). Miss all 6 and you get 0.',
    sources: [
      { name: 'Open Food Facts product API', url: 'https://world.openfoodfacts.org/api/v2/product/3017620422003.json', note: 'Structured ingredient lists from packaging, crowd-sourced (ODbL)' },
      { name: 'Open Food Facts search-a-licious', url: 'https://search.openfoodfacts.org/', note: 'Used to look up barcodes' },
    ],
    dataNote: 'For each food we took the most-scanned Open Food Facts entry whose ingredient list parses cleanly. Only top-level ingredients are kept (sub-ingredients in brackets are dropped), in label order from largest to smallest share. Names come from the Open Food Facts English taxonomy. The same product can have a different recipe in each country, so the answer is whatever that entry says. This is a snapshot, not live data.',
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

    const nameNode = (id) => ui.h('span', dict[id]);
    const list = (from, to) => ui.h('ol', { start: from + 1, style: { margin: '4px 0 0', paddingLeft: '1.6em' } },
      rev.slice(from, to).map((id) => ui.h('li', nameNode(id))));
    const clues = counts.map((c, k) => {
      const from = k ? counts[k - 1] : 0;
      const head = k === 0
        ? `This food lists ${N} ingredients. The ${c === 1 ? 'smallest one' : `${c} smallest`}:`
        : k === counts.length - 1 ? `The last ${c - from}, and the biggest: the full list.` : `${c - from} more, a bit bigger:`;
      return ui.h('div', head, list(from, c));
    });

    const options = all.map((x) => ({ id: x.id, label: x.name, hint: x.brand, aliases: [x.brand] }));
    let used = 0;
    const res = await ctx.guess({
      options, answer: ans.id, maxGuesses: MAX_GUESSES, title: 'What food is this?', placeholder: 'Product or brand…',
      clues, cluesTitle: 'Ingredients (smallest first)', columns: ['Category', 'Count', 'Shared'],
      near: (g, a) => byId.get(g.id).cat === byId.get(a.id).cat,
      onGuess: () => { used++; },
      feedback: (g) => {
        const gp = byId.get(g.id);
        const d = gp.ing.length - N;
        const sh = sharedCount(gp, ans);
        return [
          { text: gp.cat, state: gp.cat === ans.cat ? 'hit' : undefined },
          { text: d === 0 ? `${N}` : `${gp.ing.length} ${d > 0 ? '↓' : '↑'}`, num: true, state: d === 0 ? 'hit' : Math.abs(d) <= 2 ? 'near' : undefined },
          { text: `${sh}/${new Set(gp.ing).size}`, num: true, state: sh === new Set(gp.ing).size && sh === new Set(ans.ing).size ? 'hit' : sh / new Set(gp.ing).size >= 0.5 ? 'near' : undefined, title: 'How many of the guessed product\u2019s ingredients also appear in the answer' },
        ];
      },
    });

    // Learnable: what in the list gave it away, specific to this product.
    const tells = distinctive(ans, all, 3);
    const seenAt = (id) => counts.findIndex((c) => rev.indexOf(id) < c) + 1;
    const tellText = tells.map((t) => {
      const others = all.filter((x) => x.id !== ans.id && x.ing.includes(t.id)).map((x) => x.name);
      const rare = t.df === 1
        ? `only this product, out of ${all.length}, has it`
        : `only ${t.df} of ${all.length} products have it (${others.slice(0, 2).join(', ')}${t.df > 3 ? ', …' : ''} and this one)`;
      return ui.h('li', ui.h('b', dict[t.id]), `: ${rare}. On the label it is ${ordinal(rev.indexOf(t.id) + 1)} (clue ${seenAt(t.id)}).`);
    });
    const shown = counts[Math.max(1, Math.min(used, MAX_GUESSES)) - 1];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `Answer: ${ans.name} (${ans.brand}), category \u201c${ans.cat}\u201d, ${N} ingredients on the label.`),
      ui.h('div', null, ui.h('b', 'The ingredients that give it away'), ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.4em' } }, tellText)),
      ui.h('div', null, ui.h('b', 'Full list (largest first)'),
        ui.h('ol', { style: { margin: '4px 0 0', paddingLeft: '1.6em' } },
          ans.ing.map((id, i) => ui.h('li', { style: { opacity: ans.ing.length - i <= shown ? 1 : 0.6 } }, nameNode(id))))),
      ui.h('div', { class: 'small muted' }, `You saw the last ${Math.min(shown, N)}. The small print (emulsifiers, flavourings, colours, vitamin premixes) often identifies a brand better than the bulk ingredients up front.`),
      ui.h('div', { class: 'small muted' }, 'Barcode ', ui.h('a', { href: `https://world.openfoodfacts.org/product/${ans.code}`, target: '_blank', rel: 'noopener' }, ans.code), ' (Open Food Facts)'));
    return res;
  },
};
