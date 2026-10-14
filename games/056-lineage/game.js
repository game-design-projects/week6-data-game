// #56 Lineage — a royal family tree with every name blacked out; name the dynasty.
import { fmtNum } from '../../engine/core.js';

export const yearStr = (y) => (y == null ? '?' : y < 0 ? `前${-y}` : String(y));
export const spanStr = (n) => `${yearStr(n.by)}–${n.dy == null ? '' : yearStr(n.dy)}`;
export const mid = (h) => Math.round((h.first + h.last) / 2);
/** Short alias list so "Bourbon" / "Habsburg" also find "House of Bourbon". */
export const aliasesOf = (name) => {
  const s = name.replace(/^House of\s+/i, '').replace(/\s+(dynasty|house|clan)$/i, '').trim();
  return s && s !== name ? [s] : [];
};
/** Feedback for a guessed house vs the answer: era direction + continent match. */
export function compare(g, a) {
  const d = mid(g) - mid(a);
  const era = Math.abs(d) < 60 ? { text: '同一时期', state: 'hit' }
    : { text: `${d > 0 ? '偏晚' : '偏早'} ${fmtNum(Math.round(Math.abs(d) / 50) * 50)} 年`, state: Math.abs(d) < 200 ? 'near' : undefined, num: true };
  const shared = g.cont.filter((c) => a.cont.includes(c));
  const reg = !g.cont.length || !a.cont.length ? { text: '—' } : shared.length ? { text: '同一大洲', state: 'hit' } : { text: '不同大洲', state: 'miss' };
  return [era, reg];
}

export default {
  meta: {
    num: 56,
    slug: 'lineage',
    title: 'Lineage',
    tagline: '一张所有名字都被涂黑的王室族谱，只剩生卒年和性别。说出这是哪个王朝。',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      '图里是维基数据（Wikidata）里某个王室的一棵真实家谱：缩进表示父子，♂/♀ 是性别，黑条是被涂掉的名字。',
      '从列表里选一个王朝来猜，最多 6 次。每猜错一次，多解锁一条线索：统计数据、头衔、成员的名字……',
      '每次猜测会告诉你：你猜的王朝比答案偏早还是偏晚，以及是否在同一个大洲。',
      '读图技巧：世代很密、寿命很短说明战乱或早婚；女性占比高、头衔里有 Queen 常见于允许女继承的王朝；跨度上千年的多半是古代王朝。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'Wikidata（家族 P53、父亲 P22、母亲 P25、头衔 P39/P97）', url: 'https://query.wikidata.org/' },
      { name: 'Wikidata Query Service', url: 'https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service' },
    ],
    dataNote: '家谱来自维基数据里记录了出生年份和父母关系的成员，不是完整的历史族谱，缺失的人不会出现。每个王朝只取最多 14 位相连的成员（优先知名者）。头衔里的地名已涂掉。',
  },

  puzzle({ data, pick }) {
    return { q: pick(data.houses).q };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const houses = ctx.data.houses;
    const ans = houses.find((h) => h.q === p.q);
    const byQ = new Map(houses.map((h) => [h.q, h]));
    ctx.log('lineage answer', ans.name, 'tree nodes', ans.tree.length);

    const depth = (i) => { let d = 0; for (let k = ans.tree[i].p; k >= 0; k = ans.tree[k].p) d++; return d; };
    const depths = ans.tree.map((_, i) => depth(i));
    const tree = ui.h('div', { class: 'mono small', style: { lineHeight: '1.9' } },
      ans.tree.map((n, i) => ui.h('div', { style: { paddingLeft: `${Math.min(depths[i], 7) * 8}px` } },
        ui.h('span', { class: 'muted' }, depths[i] ? '└ ' : ''),
        ui.h('span', { style: { color: n.w ? 'var(--accent)' : 'var(--ink2)' } }, n.w ? '♀ ' : '♂ '),
        ui.redact('▇▇▇▇▇▇▇'), ' ',
        ui.h('span', null, spanStr(n)),
        n.t ? ui.h('span', { class: 'muted' }, `  ${n.t}`) : '')));

    const treeMin = Math.min(...ans.tree.map((n) => n.by)), treeMax = Math.max(...ans.tree.map((n) => n.by));
    const gens = Math.max(...depths) + 1;
    const stats = ui.h('div', { class: 'ds-grid', style: { '--min': '120px' } },
      ui.stat({ label: '图中出生年份', value: `${yearStr(treeMin)}–${yearStr(treeMax)}`, sub: `${treeMax - treeMin} 年` }),
      ui.stat({ label: '图中世代', value: gens, sub: `${ans.tree.length} 位成员` }),
      ui.stat({ label: '平均寿命', value: ans.avgLife ? `${ans.avgLife} 岁` : '—', sub: `女性占 ${ans.female}%` }),
      ui.stat({ label: '数据库里的成员', value: ans.total, sub: '有出生年份者' }));
    const titles = ans.titles.length
      ? ui.h('div', '该王朝成员最常见的头衔（地名已涂掉）：', ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.2em' } }, ans.titles.map(([t, c]) => ui.h('li', `${t}  ×${c}`))))
      : '维基数据里几乎没有记录该王朝成员的头衔。';
    const clues = [
      ui.h('div', tree),
      stats,
      titles,
      ui.h('div', '图中成员的名字（只给名，不给姓和封号）：', ui.h('div', { style: { marginTop: '6px' } }, ui.chips(ans.names))),
      ans.cont.length ? `这个家族的成员主要活动在：${ans.cont.join('、')}。` : '维基数据没有记录该家族成员的活动地区。',
      ui.h('div', `王朝名以 “${ans.name.replace(/^House of\s+/i, '')[0]}” 开头；知名成员：`, ui.h('b', ` ${ans.famous}`)),
    ];

    const options = houses.map((h) => ({ id: h.q, label: h.name, aliases: aliasesOf(h.name) }));
    const res = await ctx.guess({
      options,
      answer: ans.q,
      maxGuesses: 6,
      title: '这是哪个王朝？',
      placeholder: '输入王朝名（英文，如 Bourbon）…',
      clues,
      cluesTitle: '族谱与线索',
      columns: ['时代', '地区'],
      near: (g, a) => Math.abs(mid(byQ.get(g.id)) - mid(byQ.get(a.id))) < 150 && compare(byQ.get(g.id), byQ.get(a.id))[1].state === 'hit',
      feedback: (g, a) => (g.id === a.id ? [{ text: '🎯', state: 'hit' }, { text: '🎯', state: 'hit' }] : compare(byQ.get(g.id), byQ.get(a.id))),
    });

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${ans.name}（${yearStr(ans.first)}–${yearStr(ans.last)} 年间出生的成员）。`),
      ui.table({
        columns: [{ key: 'n', label: '成员' }, { key: 'y', label: '生卒' }, { key: 'tr', label: '头衔' }],
        rows: ans.tree.map((n) => ({ n: `${n.w ? '♀' : '♂'} ${n.n}`, y: spanStr(n), tr: n.tr || '' })),
      }),
      ui.h('div', { class: 'small muted' }, `关键线索：成员的出生年份集中在 ${yearStr(ans.first)}–${yearStr(ans.last)}，${ans.cont.length ? `活动于${ans.cont.join('、')}，` : ''}最知名成员是 ${ans.famous}。`));
    return res;
  },
};
