// #56 Lineage — a royal family tree with every name blacked out; name the dynasty.
import { fmtNum } from '../../engine/core.js';

export const yearStr = (y) => (y == null ? '?' : y < 0 ? `前${-y}` : String(y));
export const spanStr = (n) => `${yearStr(n.by)}–${n.dy == null ? (n.by > 1910 ? '' : '?') : yearStr(n.dy)}`;
export const mid = (h) => Math.round((h.first + h.last) / 2);
export const CONT_ZH = { Europe: '欧洲', Asia: '亚洲', Africa: '非洲', 'North America': '北美洲', 'South America': '南美洲', Oceania: '大洋洲' };
export const contZh = (cs) => cs.map((c) => CONT_ZH[c] || c).join('、');
/** "House of Orange-Nassau" -> "Orange-Nassau"; "Ming dynasty" -> "Ming". */
export const keyName = (name) => name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/^(Imperial |Capetian )?House of\s+/i, '').replace(/\s+(dynasty|house|clan)$/i, '').replace(/\s+dynasty of .*$/i, '').trim();
const plain = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Short alias list so "Bourbon" / "Habsburg" / "Zahringen" also find the house. */
export const aliasesOf = (name) => {
  const k = keyName(name);
  return [...new Set([k, plain(k), plain(name)])].filter((x) => x && x !== name);
};
/** Linear score: 100 on the 1st guess, then −100/6 per extra guess, 0 when never found. */
export const scoreFor = (n, won, max = 6) => (won ? Math.round((100 * (max - n + 1)) / max) : 0);
/** Flatten houses into puzzles: one per (house, tree). */
export const poolOf = (data) => data.houses.flatMap((h, hi) => h.trees.map((_, ti) => ({ q: h.q, t: ti, hi })));
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
      '图里是维基数据（Wikidata）中某个王室的一棵真实家谱：缩进表示父子，♂/♀ 是性别，黑条是被涂掉的名字，后面是生卒年和头衔（地名已涂掉）。',
      '从列表里选一个王朝来猜（英文名，最多 6 次）。每猜错一次多解锁一条线索：统计、头衔、成员的名字、活动地区、王朝名的首字母。',
      '每次猜测会告诉你：你猜的王朝比答案偏早还是偏晚，以及是否和答案在同一个大洲。',
      '读图技巧：世代密、寿命短多半是早期或战乱年代；女性占比高、头衔里常有 Queen 的，多是允许女继承的王朝；出现 Pharaoh、Shah、Sultan 这类词，地区立刻缩小。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分（100 / 83 / 67 / 50 / 33 / 17），6 次都没猜中 0 分。',
    sources: [
      { name: 'Wikidata Query Service（家族 P53、父 P22、母 P25、头衔 P39/P97、国籍所在洲 P27/P30）', url: 'https://query.wikidata.org/' },
      { name: 'Wikidata 实体搜索 API（解析知名王朝）', url: 'https://www.wikidata.org/w/api.php?action=help&modules=wbsearchentities' },
    ],
    dataNote: '快照数据，2026-10-14 抓取。端点 query.wikidata.org 与 wikidata.org/w/api.php 虽然支持 CORS，但查询很重、常被限流，所以不在浏览器里实时请求，由 build/ 脚本离线生成。家谱只包含维基数据里记录了出生年份和父母关系的成员，不是完整的历史族谱；每个王朝最多取 3 棵互不重叠的子树，每棵最多 14 人（优先知名者）。头衔只保留通用的爵位等级（King、Duke、Emperor 等），其余字样和地名一律去掉，避免泄露答案。时代与地区的反馈按该王朝全部有出生年份的成员统计。',
  },

  puzzle({ data, pick }) {
    const p = pick(poolOf(data));
    return { q: p.q, t: p.t };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const houses = ctx.data.houses;
    const ans = houses.find((h) => h.q === p.q);
    const { tree: nodes, names } = ans.trees[p.t];
    const byQ = new Map(houses.map((h) => [h.q, h]));
    ctx.log('lineage answer', ans.name, 'tree', p.t, 'nodes', nodes.length);

    const depth = (i) => { let d = 0; for (let k = nodes[i].p; k >= 0; k = nodes[k].p) d++; return d; };
    const depths = nodes.map((_, i) => depth(i));
    const tree = ui.h('div', { class: 'mono small', style: { lineHeight: '1.8' } },
      nodes.map((n, i) => ui.h('div', { style: { paddingLeft: `${Math.min(depths[i], 6) * 8}px`, display: 'flex', flexWrap: 'wrap', columnGap: '0.6em', alignItems: 'baseline' } },
        ui.h('span', { style: { whiteSpace: 'nowrap' } },
          ui.h('span', { class: 'muted' }, depths[i] ? '└ ' : ''),
          ui.h('span', { style: { color: n.w ? 'var(--accent)' : 'var(--ink2)' }, 'aria-label': n.w ? '女' : '男' }, n.w ? '♀ ' : '♂ '),
          ui.redact('▇▇▇▇▇')),
        ui.h('span', { style: { whiteSpace: 'nowrap' } }, spanStr(n)),
        n.t ? ui.h('span', { class: 'muted', style: { whiteSpace: 'nowrap' } }, n.t) : null)));

    const treeMin = Math.min(...nodes.map((n) => n.by)), treeMax = Math.max(...nodes.map((n) => n.by));
    const gens = Math.max(...depths) + 1;
    const stats = ui.h('div', { class: 'ds-grid', style: { '--min': '120px' } },
      ui.stat({ label: '图中出生年份跨度', value: `${fmtNum(treeMax - treeMin)} 年`, sub: `${nodes.length} 位成员` }),
      ui.stat({ label: '图中世代', value: gens, sub: gens > 1 ? `平均每代约 ${Math.round((treeMax - treeMin) / (gens - 1))} 年` : '' }),
      ui.stat({ label: '平均寿命', value: ans.avgLife ? `${ans.avgLife} 岁` : '—', sub: `女性占 ${ans.female}%` }),
      ui.stat({ label: '数据库里的成员', value: ans.total, sub: '有出生年份者' }));
    const titles = ans.titles.length
      ? ui.h('div', '该王朝成员最常见的头衔等级：', ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.2em' } }, ans.titles.map(([t, c]) => ui.h('li', `${t}  ×${c}`))))
      : '维基数据里几乎没有记录该王朝成员的头衔。';
    const key = keyName(ans.name);
    const clues = [
      tree,
      stats,
      titles,
      ui.h('div', '图中成员的名字（只给名，不给姓和封号）：', ui.h('div', { style: { marginTop: '6px' } }, ui.chips(names))),
      `这个家族的成员主要活动在：${contZh(ans.cont)}。`,
      ui.h('div', `王朝名（去掉 House of / dynasty）以 “${key[0].toUpperCase()}” 开头，共 ${key.replace(/[^\p{L}]/gu, '').length} 个字母；知名成员：`, ui.h('b', ` ${ans.famous}`)),
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
      scoring: scoreFor,
    });

    const topT = ans.titles.slice(0, 3).map(([t, c]) => `${t}（${c} 人）`).join('、');
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${ans.name}。该王朝有出生年份记录的 ${ans.total} 位成员，多数出生在 ${yearStr(ans.first)}–${yearStr(ans.last)} 年之间。`),
      ui.table({
        columns: [{ key: 'n', label: '成员' }, { key: 'y', label: '生卒' }, { key: 'tr', label: '头衔' }],
        rows: nodes.map((n, i) => ({ n: `${depths[i] ? '└ ' : ''}${n.w ? '♀' : '♂'} ${n.n}`, y: spanStr(n), tr: n.tr || '' })),
      }),
      ui.h('div', { class: 'small muted' }, `这张图的破绽：出生年份落在 ${yearStr(treeMin)}–${yearStr(treeMax)}，共 ${gens} 代、平均每代约 ${gens > 1 ? Math.round((treeMax - treeMin) / (gens - 1)) : '—'} 年；${topT ? `常见头衔是 ${topT}；` : ''}成员主要活动在${contZh(ans.cont)}；平均寿命 ${ans.avgLife ?? '—'} 岁、女性占 ${ans.female}%；最知名的成员是 ${ans.famous}。`));
    return res;
  },
};
