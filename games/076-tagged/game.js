// #76 Tagged — Stack Overflow titles with the tags removed; pick the tags, scored by Jaccard overlap.
export const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter / uni : 0;
};

const N_Q = 5;
const N_OPT = 10;

export default {
  meta: {
    num: 76,
    slug: 'tagged',
    title: 'Tagged',
    tagline: '去掉标签的 Stack Overflow 高赞问题，从候选里选出它真正的标签，按 Jaccard 重合度计分。',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      '每天 5 道真实的 Stack Overflow 高赞问题，只给标题。',
      '从 10 个候选标签里选出你认为提问者给它打的全部标签（数量不固定，通常 2–5 个），然后提交。',
      '每题得分 = 你选的与真实标签的交集 ÷ 并集（Jaccard）。多选、漏选、选错都会扣分。',
    ],
    scoring: '每题 Jaccard 重合度 0–1，5 题满分 5。',
    sources: [
      { name: 'Stack Exchange API（Stack Overflow 每年高赞问题）', url: 'https://api.stackexchange.com/docs/questions', note: '内容 CC BY-SA 4.0' },
    ],
    dataNote: '快照：2009–2022 每年投票最高的约 100 个问题（过滤后共 286 个）。候选里的干扰项一半来自常与真实标签共现的标签，一半来自热门标签。',
  },

  puzzle({ data, rng, pick }) {
    const co = {};
    for (const q of data.questions) for (const t of q.g) for (const u of q.g) if (t !== u) (co[t] ||= {})[u] = (co[t][u] || 0) + 1;
    const rounds = [];
    // pool of fixed 5-question sets so pick() never repeats a set until all are used
    const sets = Math.floor(data.questions.length / N_Q);
    const k = pick(Array.from({ length: sets }, (_, i) => i));
    for (const q of data.questions.slice(k * N_Q, k * N_Q + N_Q)) {
      const near = {};
      for (const t of q.g) for (const [u, n] of Object.entries(co[t] || {})) if (!q.g.includes(u)) near[u] = (near[u] || 0) + n;
      const nearList = Object.keys(near).sort((a, b) => near[b] - near[a]).slice(0, 12);
      const want = N_OPT - q.g.length;
      const fromNear = rng.sample(nearList, Math.min(nearList.length, Math.ceil(want / 2)));
      const rest = rng.sample(data.tags.slice(0, 60).filter((t) => !q.g.includes(t) && !fromNear.includes(t)), want - fromNear.length);
      rounds.push({ id: q.id, title: q.t, year: q.y, score: q.s, tags: q.g, options: rng.shuffle([...q.g, ...fromNear, ...rest]) });
    }
    return { rounds };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('puzzle', p.rounds.map((r) => r.id));
    const rounds = p.rounds.map((r) => ({
      prompt: r.title,
      body: ui.h('div', { class: 'small muted' }, `${r.year} 年 · ${r.score} 赞 · 选出全部标签`),
      options: r.options.map((t) => ({ label: t })),
      correct: r.tags.map((t) => r.options.indexOf(t)),
      explain: `真实标签：${r.tags.join('、')}`,
    }));
    const res = await ctx.rounds({ rounds, multi: true, minWidth: 110, title: '这个问题打了哪些标签？' });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, '标签是提问者给问题归类的方式：语言放第一位，其次是框架、库、具体概念。标题里出现的技术名几乎都是标签；“how/why” 类问题往往还带一个概念标签（如 sorting、regex）。'),
      ui.table({
        columns: [{ key: 'q', label: '问题' }, { key: 'tags', label: '真实标签' }],
        rows: p.rounds.map((r) => ({ q: r.title, tags: r.tags.join(', ') })),
      }));
    return res;
  },
};
