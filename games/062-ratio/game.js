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
      '从列表里选一道菜来猜，最多 6 次。每猜错一次解锁一条新线索（糖、其他配料、产地……）。',
      '每次猜测会显示你猜的菜的四项占比，箭头指向答案所在方向，±3 个百分点内算命中。',
      '读比例：面粉多、水多是面包；油脂接近面粉是酥饼；蛋比例高是蛋糕或蛋奶糊。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [{ name: 'TheMealDB 菜谱 API', url: 'https://www.themealdb.com/api.php' }],
    dataNote: '重量由菜谱里的体积/个数换算：1 杯面粉 125 g、水奶 240 g、油脂 220 g，1 个蛋 50 g。含酱料等其他部分的菜谱占比会有偏差；只收录能完整换算的 81 道菜。',
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
      height: 150, marginLeft: 56, x: { label: '占四类配料总重 %', domain: [0, 100] }, y: { label: null, domain: KEYS.map((k) => ZH[k]) },
      marks: [Plot.barX(rows, { x: 'v', y: 'k', fill: c.accent, sort: null }), Plot.text(rows, { x: 'v', y: 'k', text: (r) => `${r.v}%`, dx: 14, fill: c.ink })],
    }));
    const clues = [
      ui.h('div', chart, ui.h('div', { class: 'mono center', style: { fontSize: '1.2em' } }, `${ratioText(ans.pct)}`), ui.h('div', { class: 'small muted center' }, '面粉 : 水/奶 : 油脂 : 蛋')),
      `糖和蜜类配料占四类总重的 ${ans.sugarPct}%。`,
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
    const img = ans.img ? ui.h('img', { src: ans.img + '/small', alt: ans.name, style: { width: '100%', maxWidth: '240px', borderRadius: '8px' }, loading: 'lazy' }) : '';
    res.detail = ui.h('div', { class: 'ds-stack' }, img,
      ui.kv([['答案', ans.name], ['配比', `面粉 ${ans.pct.flour} : 水奶 ${ans.pct.liquid} : 油脂 ${ans.pct.fat} : 蛋 ${ans.pct.egg}`], ['原始重量(g)', KEYS.map((k) => `${ZH[k]} ${ans.grams[k]}`).join(' · ')], ['产地', ans.area || '—'], ['来源', ans.src || 'TheMealDB']]),
      ui.callout(ans.pct.liquid >= 35 ? '水分占比高：面糊或发酵面团。' : ans.pct.fat >= 30 ? '油脂占比高：酥、松的烘焙点心。' : ans.pct.egg >= 25 ? '蛋占比高：蛋糕、蛋奶类。' : '面粉主导，其余配料只是点缀。'));
    return res;
  },
};
