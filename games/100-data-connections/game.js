// #100 Data Connections — 16 items, 4 hidden groups; each group shares one real Wikidata statement.
export const PROPS = {
  P57: '导演 (P57)', P50: '作者 (P50)', P170: '创作者 (P170)', P175: '表演者 (P175)',
  P47: '陆地接壤 (P47)', P161: '演员 (P161)', P178: '开发者 (P178)',
};

/** Score: 25 per group found, −5 per mistake (mirrors ctx.groups). Pure helper for tests. */
export function groupScore(found, wrong) { return Math.max(0, found * 25 - wrong * 5); }

/** True when the 16 labels of a puzzle are all different (ambiguity check). */
export function unambiguous(groups) {
  const seen = new Set();
  for (const g of groups) for (const it of g.items) seen.add(it.l);
  return seen.size === groups.reduce((n, g) => n + g.items.length, 0);
}

/** Year span of a group's items, e.g. "1960–1999", or '' when no years are known. */
export function yearSpan(items) {
  const ys = items.map((i) => i.y).filter(Number.isFinite);
  if (ys.length < 2) return ys.length ? String(ys[0]) : '';
  const lo = Math.min(...ys); const hi = Math.max(...ys);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/** One-line "how you could tell" for the result card, specific to this group and puzzle. */
export function why(g, groups) {
  const span = yearSpan(g.items);
  const twins = groups.filter((o) => o !== g && o.unit === g.unit).map((o) => o.n);
  const parts = [`Wikidata 里这 4 条都满足「${PROPS[g.prop] ?? g.prop} = ${g.n}」`];
  if (span && g.kind !== 'border') parts.push(`年份集中在 ${span}`);
  if (twins.length) parts.push(`和同为「${g.unit}」的${twins.join('、')}那组最容易混淆`);
  return parts.join('；') + '。';
}

/** Types of item present today, for the rules hint (generic, not an answer). */
export function unitsOf(groups) { return [...new Set(groups.map((g) => g.unit))]; }

export default {
  meta: {
    num: 100,
    slug: 'data-connections',
    title: 'Data Connections',
    tagline: '16 个条目藏着 4 组关系，每一组共享一条真实的维基数据（Wikidata）陈述。找出它们。',
    category: 'model',
    data: 'snapshot',
    howTo: [
      '16 个条目分属 4 组，每组 4 个。选出你认为同组的 4 个，点「提交」；猜对的一组会翻开并亮出它们共享的关系。',
      '每组的共同点是 Wikidata 里的一条属性，例如「某导演执导的电影」「某画家的画作」「与某国陆地接壤的国家」。条目都取自该关系下最知名的作品或国家。',
      '最多允许 4 次失误；提示「差一个」表示你选的 4 个里有 3 个同组。可以点「打乱」换个视角。',
      '计分：每找出一组 +25 分，每次失误 −5 分，满分 100。结果卡会告诉你每组是怎么看出来的。',
    ],
    scoring: '每找出一组 +25 分，每次失误 −5 分（满分 100，最低 0）。',
    sources: [
      { name: 'Wikidata Query Service (SPARQL)', url: 'https://query.wikidata.org/', note: '各关系下按维基百科语言版本数（sitelinks）取最知名的条目，条目名为简体中文标签' },
      { name: 'Wikidata', url: 'https://www.wikidata.org/', note: '属性 P57 导演、P161 演员、P50 作者、P170 创作者、P175 表演者、P178 开发者、P47 接壤（仅保留陆地邻国）' },
    ],
    dataNote: '题目由程序离线生成，不是实时数据：从 Wikidata 取一百多位导演、演员、作者、画家、歌手、游戏厂商和国家，每组取最知名的 14 个条目（只保留简体中文标签、类型匹配的电影 / 书 / 画作 / 专辑歌曲 / 游戏 / 国家），再随机组合 4 组成题。离线歧义过滤代替人工 / LLM 评分：只要某个条目也出现在该组之外任何一个已抓取的组里（例如同时是导演和主演的电影），就整条剔除；国家组只保留陆地接壤。Wikidata 是众包的，个别条目可能不完整，不会影响答案唯一性。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { groups: p.groups };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('puzzle', p.groups.map((g) => g.qid));
    ctx.stage.append(ui.panel({ kicker: '规则', title: '4 × 4' },
      ui.h('p', { class: 'ink2' }, `16 个条目分属 4 组，每组共享同一条 Wikidata 关系。今天的条目有：${unitsOf(p.groups).join('、')}。`),
      ui.h('p', { class: 'small muted' }, '先找最没有歧义的一组；同一类条目（比如几位导演的电影）要靠年代、题材和人物来区分。')));
    const r = await ctx.groups({
      groups: p.groups.map((g) => ({ label: g.label, items: g.items.map((i) => i.l) })),
      mistakes: 4,
      title: '找出四组',
    });
    r.detail = ui.kv(p.groups.map((g) => [
      g.label,
      ui.h('div', {},
        ui.h('div', {}, g.items.map((i) => (i.y ? `${i.l}（${i.y}）` : i.l)).join('、')),
        ui.h('div', { class: 'small muted' }, why(g, p.groups), ' ',
          ui.h('a', { href: `https://www.wikidata.org/wiki/${g.qid}`, target: '_blank', rel: 'noopener' }, g.qid))),
    ]));
    return r;
  },
};
