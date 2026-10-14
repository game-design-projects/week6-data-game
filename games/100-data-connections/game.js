// #100 Data Connections — 16 items, 4 hidden groups; each group shares a real Wikidata statement.
export const PROPS = {
  P57: '导演 (P57)', P50: '作者 (P50)', P170: '创作者 (P170)', P175: '表演者 (P175)',
  P47: '与…接壤 (P47)', P161: '演员 (P161)', P178: '开发者 (P178)',
};

/** Score: 25 per group found, −5 per mistake (mirrors ctx.groups). Pure helper for tests. */
export function groupScore(found, wrong) { return Math.max(0, found * 25 - wrong * 5); }

/** True when no item of a group is also listed under another group's label (ambiguity check). */
export function unambiguous(groups) {
  const seen = new Set();
  for (const g of groups) for (const it of g.items) { if (seen.has(it.l)) return false; seen.add(it.l); }
  return seen.size === groups.length * groups[0].items.length;
}

export default {
  meta: {
    num: 100,
    slug: 'data-connections',
    title: 'Data Connections',
    tagline: '16 个条目藏着 4 组关系，每一组共享一条真实的维基数据（Wikidata）陈述。找出它们。',
    category: 'model',
    data: 'snapshot',
    howTo: [
      '选出 4 个你认为属于同一组的条目，点「提交」。猜对的一组会翻开并显示它们共享的关系。',
      '每组的关系来自 Wikidata 的一条属性，例如「某导演执导的电影」「与某国接壤的地区」「某画家的画作」。',
      '最多允许 4 次失误；「差一个」会提示你只错了一项。可以用「打乱」换个视角。',
      '先从最没有歧义的一组下手：同一个人的作品常常有相近的年代或题材。',
    ],
    scoring: '每找出一组 +25 分，每次失误 −5 分，满分 100。',
    sources: [
      { name: 'Wikidata Query Service (SPARQL)', url: 'https://query.wikidata.org/', note: '按 sitelinks 数量取每个关系中最知名的条目，条目名为简体中文标签' },
    ],
    dataNote: '题目由程序离线生成：从 Wikidata 取 40 个关系，每个关系取最知名的 12 个条目，随机组合 4 个关系成一题，并剔除任何同时属于其他三组的条目（歧义过滤，代替人工 / LLM 评分）。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { groups: p.groups };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('puzzle', p.groups.map((g) => g.qid));
    ctx.stage.append(ui.panel({ kicker: '规则', title: '4 × 4' },
      ui.h('p', { class: 'ink2' }, '16 个条目分属 4 组。每组 4 个，共享同一个 Wikidata 属性。提示：关系有的是人，有的是地区——先想「谁和谁最像」。')));
    const r = await ctx.groups({
      groups: p.groups.map((g) => ({ label: g.label, items: g.items.map((i) => i.l) })),
      mistakes: 4,
      title: '找出四组',
    });
    r.detail = ui.kv(p.groups.map((g) => [
      g.label,
      ui.h('span', {}, g.items.map((i) => i.l).join('、'), ui.h('span', { class: 'small muted' }, `  · ${PROPS[g.prop] ?? g.prop} · `),
        ui.h('a', { href: `https://www.wikidata.org/wiki/${g.qid}`, target: '_blank', rel: 'noopener' }, g.qid)),
    ]));
    return r;
  },
};
