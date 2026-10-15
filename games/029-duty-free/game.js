// #29 Duty Free — an absurdly specific line of the US tariff schedule; guess its duty rate.
const fmtRate = (r) => (r === 0 ? 'Free（0%）' : `${r}%`);

/** Per-item teaching text, specific to the line: chapter norm vs this line, column-2 and FTA hints. */
export function explain(it, data) {
  const ch = data.chapters[it.c];
  const name = data.names[it.c];
  const parts = [];
  if (ch) {
    const side = it.r === 0 ? '免税' : it.r > ch.med ? `高于中位数 ${ch.med}%` : it.r < ch.med ? `低于中位数 ${ch.med}%` : '正好是中位数';
    parts.push(`第 ${it.c} 章「${name}」共 ${ch.n} 条纯从价税条目，${ch.free}% 免税、中位数 ${ch.med}%、最高 ${ch.max}%；本条 ${fmtRate(it.r)}，${side}。`);
  }
  if (it.o != null) parts.push(`第二栏税率（对未享正常贸易关系的国家）为 ${fmtRate(it.o)}。`);
  if (it.f) parts.push('自贸协定伙伴（如澳大利亚、韩国、以色列等）进口可免税。');
  return parts.join('');
}

export const SCALE = 3;
/** Score one guess (same curve as ctx.estimate 'abs' with scale SCALE). */
export const scoreGuess = (guess, answer) => Math.round(100 * Math.exp(-Math.abs(guess - answer) / SCALE));

export default {
  meta: {
    num: 29,
    slug: 'duty-free',
    title: 'Duty Free',
    tagline: '美国关税表里一条离谱具体的商品，猜它的进口税率。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '每天 3 条来自美国统一关税表（HTS）的商品条目，描述精确到令人发笑；题目会给出所属章节和计量单位作线索。',
      '用滑块或输入框猜它的一般税率（%）：不少条目其实是免税（0%），也有高达三十多的。',
      '每条只有一次机会，提交后立刻揭晓，并对照同章节的税率分布和第二栏税率讲解规律。',
    ],
    scoring: '按绝对误差计分：差 0 个百分点 100 分，差 3 个百分点约 37 分，差 9 个百分点约 5 分；三条相加，满分 300。',
    sources: [{ name: 'USITC Harmonized Tariff Schedule (REST export)', url: 'https://hts.usitc.gov/reststop/exportList?from=0101&to=9999&format=JSON&styles=false', note: '取一般税率（Column 1 General）为免税或单一百分比的条目，按 8 位税号去重' }],
    dataNote: '税率取自 HTS 快照（日期见 data.json）。只收录“税率是单一百分比或 Free”的条目，含从量税、混合税的条目已剔除；章节 98/99 及“Other › Other”式兜底条目已剔除。表中为法定一般（MFN）税率，不含近年按 301/232 等条款额外加征的关税，实际报关税负可能更高。关税表不按天变化，因此没有实时接口，每期题目从 90 组固定题目里按日轮换。',
  },

  puzzle({ data, pick }) {
    return { items: pick(data.puzzles).map((i) => data.items[i].h) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const by = new Map(ctx.data.items.map((x) => [x.h, x]));
    const results = [];
    const rows = [];
    for (let i = 0; i < p.items.length; i++) {
      const it = by.get(p.items[i]);
      ctx.log('item', it.h, it.r);
      const body = ui.h('div', { class: 'ds-stack' },
        ui.quote(it.d),
        ui.h('div', { class: 'small muted mono' }, `HTS ${it.h} · 第 ${it.c} 章 ${ctx.data.names[it.c]}${it.u ? ` · 计量单位 ${it.u}` : ''}`));
      const holder = ui.h('div');
      ctx.stage.append(holder);
      holder.append(ui.panel({ kicker: `第 ${i + 1} / ${p.items.length} 条`, title: '这件商品的进口税率是多少？' }, body));
      const r = await ctx.estimate({
        answer: it.r, min: 0, max: 40, step: 0.5, initial: 5, scoring: 'abs', scale: SCALE,
        attempts: 1, tolerance: 0.5, container: holder, title: '你的猜测', format: (v) => `${v}%`,
      });
      results.push(r);
      rows.push({ h: it.h, r: fmtRate(it.r), g: `${r.guess}%`, why: explain(it, ctx.data) });
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ...rows.map((row, i) => ui.h('div', { class: 'ds-stack' },
        ui.h('div', null, ui.h('b', null, `第 ${i + 1} 条 · ${row.h}`), ` 实际 ${row.r}，你猜 ${row.g}`),
        ui.h('div', { class: 'ink2 small' }, row.why))));
    return res;
  },
};
