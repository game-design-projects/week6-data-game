// #62 Ratio — only the flour : liquid : fat : egg ratio is shown; name the dish.
const KEYS = ['flour', 'liquid', 'fat', 'egg'];
const ZH = { flour: 'Flour', liquid: 'Liquid', fat: 'Fat', egg: 'Egg' };

/** Per-component feedback: hit within 3 points, otherwise an arrow toward the answer. */
export function cmp(g, a) {
  return KEYS.map((k) => {
    const d = a.pct[k] - g.pct[k];
    if (Math.abs(d) <= 3) return { text: `${g.pct[k]}%`, state: 'hit', num: true };
    return { text: `${g.pct[k]}% ${d > 0 ? '↑' : '↓'}`, state: Math.abs(d) <= 10 ? 'near' : undefined, num: true };
  });
}
/** Distance between two ratios: sum of absolute point differences. */
export const dist = (a, b) => KEYS.reduce((t, k) => t + Math.abs(a.pct[k] - b.pct[k]), 0);

/** Closest other dishes by ratio (the ones a player is most likely to confuse with the answer). */
export function lookalikes(ans, dishes, n = 2) {
  return dishes.filter((d) => d.id !== ans.id).map((d) => ({ d, x: dist(d, ans) })).sort((a, b) => a.x - b.x || (a.d.id < b.d.id ? -1 : 1)).slice(0, n).map((o) => o.d);
}

/** Puzzle-specific teaching text: which component(s) give the dish away. */
export function explain(ans, dishes) {
  const p = ans.pct;
  const top = KEYS.filter((k) => p[k] > 0).sort((a, b) => p[b] - p[a]);
  const bits = [];
  if (p.liquid >= 45) bits.push(`Liquid is ${p.liquid}%, far more than flour, which means a thin batter, a milk-and-egg custard or a pudding. `);
  else if (p.liquid >= 25 && p.fat < 20) bits.push(`Liquid at ${p.liquid}% with flour at ${p.flour}% is close to the hydration of bread or batter. `);
  if (p.fat >= 30) bits.push(`Fat is as high as ${p.fat}%, giving a short, flaky, rich texture common in cookies, tarts and cakes. `);
  else if (p.fat <= 5) bits.push(`Almost no fat (${p.fat}%), which usually means a yeast bread, a wrapper or a pancake. `);
  if (p.egg >= 25) bits.push(`Egg is ${p.egg}%, with the egg holding up the structure, typical of cakes and custards. `);
  else if (p.egg === 0) bits.push('No egg at all, which suggests a bread, a pastry or a flatbread. ');
  if (p.flour >= 50 && p.liquid < 15) bits.push(`Flour is over half (${p.flour}%) with very little liquid, which makes a stiff dough or a cookie. `);
  if (!bits.length) bits.push(`Flour ${p.flour}% and ${(ZH[top[1]] || 'Liquid').toLowerCase()} ${p[top[1]] || 0}% are fairly balanced, so only the sugar, category and origin clues can separate it. `);
  const near = lookalikes(ans, dishes).map((d) => `${d.name} (${ratioText(d.pct)})`);
  return { bits: bits.slice(0, 3).map((x) => x.trim()), near };
}

export const ratioText = (p) => KEYS.map((k) => p[k]).join(' : ');

export default {
  meta: {
    num: 62,
    slug: 'ratio',
    title: 'Ratio',
    tagline: 'You get only the flour : liquid : fat : egg ratio. Name the dish.',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      'The bar chart shows the weight share of four ingredient groups in a dish: flour, water or milk, fat and egg.',
      'Pick a dish from the list. You get up to 6 guesses, and each miss unlocks another clue (sugar, category, other ingredients, origin, first letter).',
      'Each guess shows that dish\'s four shares, with arrows pointing toward the answer; within ±3 percentage points counts as a hit.',
      'Reading ratios: lots of flour and lots of water is bread; fat close to flour is shortbread; a high egg share is cake or custard.',
    ],
    scoring: 'A correct first guess scores 100, and each extra guess costs about 17 points (83 on the 2nd guess, 67 on the 3rd, down to 17 on the 6th). Six misses score 0.',
    sources: [{ name: 'TheMealDB recipe API', url: 'https://www.themealdb.com/api.php' }],
    dataNote: 'Weights are converted from the recipes\' volumes and counts: 1 cup of flour is 125 g, of water or milk 240 g, of fat 220 g, and 1 egg is 50 g. Recipes with sauces or other components can be off. Only the 72 dishes that convert fully are included; soups (where flour only thickens) and fried dishes (where frying oil would count as fat) were dropped, and dishes with identical ratios keep only one. TheMealDB is a community-maintained recipe library, so the recipes themselves are not authoritative.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.dishes).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const dishes = ctx.data.dishes;
    const ans = dishes.find((d) => d.id === p.id);
    ctx.log('answer', ans.name, ans.pct);

    const rows = KEYS.map((k) => ({ k: ZH[k], v: ans.pct[k] }));
    const chart = await ui.plot((Plot, c) => ({
      height: 150, marginLeft: 56, marginRight: 40, x: { label: null, domain: [0, 100], axis: null, grid: false }, y: { label: null, domain: KEYS.map((k) => ZH[k]) },
      marks: [Plot.barX(rows, { x: 'v', y: 'k', fill: c.accent, sort: null }), Plot.text(rows, { x: 'v', frameAnchor: 'left', y: 'k', text: (r) => `${r.v}%`, textAnchor: 'start', dx: 4, fill: c.ink })],
    }));
    const clues = [
      ui.h('div', chart, ui.h('div', { class: 'mono center', style: { fontSize: '1.2em' } }, `${ratioText(ans.pct)}`), ui.h('div', { class: 'small muted center' }, 'Flour : liquid : fat : egg')),
      ans.sugarPct ? `Sugar and honey make up about ${ans.sugarPct}% of the weight of the four ingredient groups.` : 'There is almost no sugar or honey in the recipe.',
      `Recipe category: ${ans.cat}.`,
      `Other ingredients: ${ans.extra.slice(0, 4).join(', ') || '(none)'}.`,
      `Origin: ${ans.area || 'not listed'}.`,
      `The name starts with “${ans.name[0]}” and has ${ans.name.length} characters.`,
    ];
    const res = await ctx.guess({
      options: dishes.map((d) => ({ id: d.id, label: d.name, hint: d.area })),
      answer: ans.id,
      maxGuesses: 6,
      title: 'Which dish is this?',
      placeholder: 'Type a dish name…',
      clues, cluesTitle: 'Ratio and clues',
      columns: KEYS.map((k) => ZH[k]),
      near: (g, a) => dishes.find((d) => d.id === g.id).cat === dishes.find((d) => d.id === a.id).cat,
      feedback: (g, a) => cmp(dishes.find((d) => d.id === g.id), dishes.find((d) => d.id === a.id)),
    });
    const ex = explain(ans, dishes);
    const img = ans.img ? ui.h('img', { src: ans.img + '/small', alt: ans.name, style: { width: '100%', maxWidth: '240px', borderRadius: '8px' }, loading: 'lazy' }) : '';
    res.detail = ui.h('div', { class: 'ds-stack' }, img,
      ui.kv([['Answer', ans.name], ['Ratio', `flour ${ans.pct.flour} : liquid ${ans.pct.liquid} : fat ${ans.pct.fat} : egg ${ans.pct.egg}`], ['Raw weights (g)', KEYS.map((k) => `${ZH[k].toLowerCase()} ${ans.grams[k]}`).join(' · ')], ['Origin', ans.area || '—'], ['Recipe', ans.src ? ui.h('a', { href: ans.src, target: '_blank', rel: 'noopener' }, 'Original recipe') : 'TheMealDB']]),
      ui.callout(ex.bits.join(' ')),
      ui.h('div', { class: 'small muted' }, `The two other dishes with the closest ratios: ${ex.near.join('; ')}.`));
    return res;
  },
};
