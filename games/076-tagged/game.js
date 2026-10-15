// #76 Tagged — Stack Overflow titles with the tags removed; pick the tags, scored by Jaccard overlap.
import { jaccard, titleHits } from './tagged-core.js';
export { jaccard, titleHits };

export const N_Q = 5;
export const N_OPT = 10;

// weighted sample without replacement (weights = how often a tag is used, so rare tags are not a giveaway)
function weighted(rng, items, weights, n) {
  const pool = items.map((x, i) => ({ x, w: weights[i] }));
  const out = [];
  while (out.length < n && pool.length) {
    let r = rng.float() * pool.reduce((s, p) => s + p.w, 0);
    let i = 0;
    while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
    out.push(pool.splice(i, 1)[0].x);
  }
  return out;
}

export function buildRound(data, qi, rng) {
  const q = data.q[qi];
  const want = N_OPT - q.g.length;
  const nearCand = (data.rel[q.g[0]] ? q.g : []).flatMap((t) => data.rel[t] || []).filter((u) => !q.g.includes(u));
  const score = {};
  nearCand.forEach((u) => { score[u] = (score[u] || 0) + 1; });
  const nearList = Object.keys(score).sort((a, b) => score[b] - score[a] || (a < b ? -1 : 1)).slice(0, 14);
  const fromNear = rng.sample(nearList, Math.min(nearList.length, Math.ceil(want / 2)));
  const restTags = data.tags.filter((t) => !q.g.includes(t) && !fromNear.includes(t));
  const restW = restTags.map((t) => data.f[data.tags.indexOf(t)]);
  const rest = weighted(rng, restTags, restW, want - fromNear.length);
  return { id: q.id, title: q.t, year: q.y, score: q.s, tags: q.g, options: rng.shuffle([...q.g, ...fromNear, ...rest]) };
}

export default {
  meta: {
    num: 76,
    slug: 'tagged',
    title: 'Tagged',
    tagline: '去掉标签的 Stack Overflow 高赞问题：只看标题，从 10 个候选里选出真实标签，按 Jaccard 重合度计分。',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '每天 5 道真实的 Stack Overflow 高赞问题（2009–2022 年各年的高票问题），只给标题，标签被拿掉了。',
      '每题给 10 个候选标签，其中 2–5 个是提问者真正打的标签。选出你认为对的全部，然后提交。',
      '每题得分 = 你选的与真实标签的交集 ÷ 并集（Jaccard，0–1）。多选、漏选、选错都会扣分；5 题满分 5。',
      '干扰项一半是常与真实标签一起出现的“近亲”标签（如 swift 与 swiftui），一半是按使用频率抽出的其他标签。',
    ],
    scoring: '每题得分 = |选中 ∩ 真实| ÷ |选中 ∪ 真实|，5 题相加，满分 5。全选 10 个只能拿到约 0.3 分/题。',
    sources: [
      { name: 'Stack Exchange API /questions（Stack Overflow）', url: 'https://api.stackexchange.com/docs/questions', note: '2009–2022 每年按票数排序的前 400 个问题；内容 CC BY-SA 4.0' },
    ],
    dataNote: '快照：每年票数最高的 400 个问题里，筛出带 2–5 个标签、标签都在常用词表里的，再按年份取前 38，共 532 题，组成 106 套每日题目（每套由易到难五个难度档各取一题）。只用标题：API 不返回正文，而正文会直接写出技术名。原创意是自由填写标签；为了让 Jaccard 计分公平且好玩，这里改为候选选择。Stack Exchange API 免 key 且支持 CORS，但本游戏不需要“今天”的数据，所以不实时拉取。',
  },

  puzzle({ data, rng, pick }) {
    const k = pick(data.sets.map((_, i) => i));
    return { rounds: data.sets[k].map((qi) => buildRound(data, qi, rng)) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('puzzle', p.rounds.map((r) => r.id));
    const rounds = p.rounds.map((r) => ({
      prompt: r.title,
      body: ui.h('div', { class: 'small muted' }, `${r.year} 年发布 · ${r.score} 赞 · 选出全部标签（2–5 个）`),
      options: r.options.map((t) => ({ label: t })),
      correct: r.tags.map((t) => r.options.indexOf(t)),
      explain: `真实标签：${r.tags.join('、')}`,
    }));
    const res = await ctx.rounds({ rounds, multi: true, minWidth: 110, title: '这个问题打了哪些标签？' });
    let seen = 0, total = 0;
    const rows = p.rounds.map((r) => {
      const hit = titleHits(r.title, r.tags), hid = r.tags.filter((t) => !hit.includes(t));
      seen += hit.length; total += r.tags.length;
      const why = hit.length === r.tags.length ? `标题里直接点名了全部标签（${hit.join('、')}）。`
        : hit.length ? `标题直接点名：${hit.join('、')}；其余（${hid.join('、')}）要靠上下文推断，例如框架决定语言、平台决定工具。`
          : `标题没有直接点名任何标签；${hid.join('、')} 全靠上下文推断。`;
      return { q: ui.h('a', { href: `https://stackoverflow.com/q/${r.id}`, target: '_blank', rel: 'noopener' }, r.title), tags: r.tags.join(', '), why };
    });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `今天 ${total} 个真实标签里，${seen} 个直接出现在标题里。规律：技术名写在标题里的基本都是标签；框架会带出语言（swiftui → swift, ios），“怎么做”类问题常带概念标签（sorting、regex、string）。`),
      ui.table({
        columns: [{ key: 'q', label: '问题' }, { key: 'tags', label: '真实标签' }, { key: 'why', label: '线索' }],
        rows,
      }));
    return res;
  },
};
