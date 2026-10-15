// #62 Ratio — only the flour : liquid : fat : egg ratio is shown; name the dish.
const KEYS = ['flour', 'liquid', 'fat', 'egg'];
const ZH = { flour: '面粉', liquid: '水/奶', fat: '油脂', egg: '蛋' };

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
  if (p.liquid >= 45) bits.push(`水/奶占 ${p.liquid}%，远多于面粉，说明是稀面糊、奶蛋糊或布丁类。`);
  else if (p.liquid >= 25 && p.fat < 20) bits.push(`水/奶 ${p.liquid}% 配上面粉 ${p.flour}%，接近面包或面糊的水合度。`);
  if (p.fat >= 30) bits.push(`油脂高达 ${p.fat}%，酥、松、起酥感强，常见于饼干、挞和蛋糕。`);
  else if (p.fat <= 5) bits.push(`几乎不放油脂（${p.fat}%），多是发酵面包、饼皮或煎饼。`);
  if (p.egg >= 25) bits.push(`蛋占 ${p.egg}%，靠蛋来撑起结构，是蛋糕、蛋奶类的特征。`);
  else if (p.egg === 0) bits.push('完全没有蛋，说明是面包、酥皮或饼类。');
  if (p.flour >= 50 && p.liquid < 15) bits.push(`面粉过半（${p.flour}%）而水很少，是紧实的面团或饼干。`);
  if (!bits.length) bits.push(`面粉 ${p.flour}%、${ZH[top[1]] || '水/奶'} ${p[top[1]] || 0}% 比较均衡，只能靠糖、分类和产地线索区分。`);
  const near = lookalikes(ans, dishes).map((d) => `${d.name}（${ratioText(d.pct)}）`);
  return { bits: bits.slice(0, 3), near };
}

export const ratioText = (p) => KEYS.map((k) => p[k]).join(' : ');

export default {
  meta: {
    num: 62,
    slug: 'ratio',
    title: 'Ratio',
    tagline: '只给面粉 : 水 : 油脂 : 蛋的配比，说出这是哪道菜。',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      '条形图是一道菜里面粉、水/奶、油脂、蛋四类配料的重量占比。',
      '从列表里选一道菜来猜（菜名为英文），最多 6 次。每猜错一次解锁一条新线索（糖、分类、其他配料、产地、首字母）。',
      '每次猜测会显示你猜的菜的四项占比，箭头指向答案所在方向，±3 个百分点内算命中。',
      '读比例：面粉多、水多是面包；油脂接近面粉是酥饼；蛋比例高是蛋糕或蛋奶糊。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分（第 2 次 83、第 3 次 67……第 6 次 17），6 次都没猜中 0 分。',
    sources: [{ name: 'TheMealDB 菜谱 API', url: 'https://www.themealdb.com/api.php' }],
    dataNote: '重量由菜谱里的体积/个数换算：1 杯面粉 125 g、水奶 240 g、油脂 220 g，1 个蛋 50 g。含酱料等其他部分的菜谱占比会有偏差；只收录能完整换算的 72 道菜；汤羹（面粉只用来勾芡）和油炸类（炸油会算进油脂）已剔除，配比完全相同的菜只留一道。TheMealDB 是社区维护的菜谱库，菜谱本身并不权威。',
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
      ui.h('div', chart, ui.h('div', { class: 'mono center', style: { fontSize: '1.2em' } }, `${ratioText(ans.pct)}`), ui.h('div', { class: 'small muted center' }, '面粉 : 水/奶 : 油脂 : 蛋')),
      ans.sugarPct ? `糖和蜜类配料约为四类配料总重的 ${ans.sugarPct}%。` : '配方里几乎没有糖或蜜。',
      `菜谱分类：${ans.cat}。`,
      `其他配料有：${ans.extra.slice(0, 4).join('、') || '（无）'}。`,
      `产地：${ans.area || '未标注'}。`,
      `名字以 “${ans.name[0]}” 开头，共 ${ans.name.length} 个字符。`,
    ];
    const res = await ctx.guess({
      options: dishes.map((d) => ({ id: d.id, label: d.name, hint: d.area })),
      answer: ans.id,
      maxGuesses: 6,
      title: '这是哪道菜？',
      placeholder: '输入菜名（英文）…',
      clues, cluesTitle: '配比与线索',
      columns: KEYS.map((k) => ZH[k]),
      near: (g, a) => dishes.find((d) => d.id === g.id).cat === dishes.find((d) => d.id === a.id).cat,
      feedback: (g, a) => cmp(dishes.find((d) => d.id === g.id), dishes.find((d) => d.id === a.id)),
    });
    const ex = explain(ans, dishes);
    const img = ans.img ? ui.h('img', { src: ans.img + '/small', alt: ans.name, style: { width: '100%', maxWidth: '240px', borderRadius: '8px' }, loading: 'lazy' }) : '';
    res.detail = ui.h('div', { class: 'ds-stack' }, img,
      ui.kv([['答案', ans.name], ['配比', `面粉 ${ans.pct.flour} : 水奶 ${ans.pct.liquid} : 油脂 ${ans.pct.fat} : 蛋 ${ans.pct.egg}`], ['原始重量(g)', KEYS.map((k) => `${ZH[k]} ${ans.grams[k]}`).join(' · ')], ['产地', ans.area || '—'], ['菜谱', ans.src ? ui.h('a', { href: ans.src, target: '_blank', rel: 'noopener' }, '原始菜谱') : 'TheMealDB']]),
      ui.callout(ex.bits.join('')),
      ui.h('div', { class: 'small muted' }, `配比最接近的另外两道菜：${ex.near.join('；')}。`));
    return res;
  },
};
