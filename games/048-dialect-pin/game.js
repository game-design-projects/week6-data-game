// #48 Dialect Pin — the NYT dialect quiz run backwards: read five answers, name the state they grew up in.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

/** Naive-Bayes share (0..1) of each state given [[qid, optionKey], …] (uniform prior, +1% smoothing). */
export function posterior(data, picks) {
  const codes = Object.keys(data.states);
  const ll = codes.map((c) => picks.reduce((a, [q, k]) => a + Math.log((data.questions[q].opts[k].p[c] ?? 0) / 100 + 0.01), 0));
  const mx = Math.max(...ll);
  const ex = ll.map((v) => Math.exp(v - mx));
  const z = ex.reduce((a, b) => a + b, 0);
  return Object.fromEntries(codes.map((c, i) => [c, ex[i] / z]));
}

/** How many answers are visible after `n` guesses have been made (2 at the start, +1 per wrong guess, max 5). */
export const visibleAnswers = (n) => Math.min(5, n + 2);

export default {
  meta: {
    num: 48,
    slug: 'dialect-pin',
    title: 'Dialect Pin',
    tagline: '把方言测验倒过来玩：看一个人怎么回答 soda 还是 pop，猜他在美国哪个州长大。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '哈佛方言调查问了美国人上百个用词问题：汽水叫 soda 还是 pop？斜对面叫 kitty-corner 还是 catty-corner？',
      '一开始你只看到一位说话人的 2 个回答。每猜错一次，多揭开一个回答，最多 6 次。',
      '每次猜测会告诉你该州离答案多远、在哪个方向，以及「像不像」：只看已揭开的回答，这个州的人这样说的可能性占 48 州的多少。',
      '诀窍：找「某个地区独有」的说法，比如 y\'all、buggy、bubbler、rolling，它们比 sneakers 或 soda 这类到处都有的词有用得多。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'Harvard Dialect Survey（Bert Vaux & Scott Golder, 2003）', url: 'http://www4.uwm.edu/FLL/linguistics/dialect/maps.html', note: '各州回答比例' },
      { name: 'asucbi/BDSR2 上的各州结果文本镜像', url: 'https://github.com/asucbi/BDSR2/tree/main/proc/hds', note: '本游戏实际下载处（原站目前难以访问）' },
    ],
    dataNote: '数据是各州回答比例，不是某个真人的完整问卷。「说话人」是用该州最有辨识度的 5 个说法拼出的一个典型代表（比该州比例≥12%、且至少是全国均值 1.7 倍的选项）。原调查没有阿拉斯加、夏威夷和华盛顿特区，也有 5 个州因说法太接近全国平均而不出题。题目只选用词类问题，读音类题的音标在镜像中丢失。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { st: p.st, clues: p.clues, rank: p.rank };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const D = ctx.data;
    const S = D.states;
    const Q = D.questions;
    const ans = S[p.st];
    const line = ([q, k]) => ui.h('div', { style: { marginBottom: '4px' } },
      ui.h('span', { class: 'muted small' }, Q[q].zh, '：'), ' ', ui.h('b', `“${Q[q].opts[k].t}”`));
    const clues = [
      ui.h('div', { class: 'ds-stack' }, ui.h('div', { class: 'small muted' }, '一位说话人这样回答：'), line(p.clues[0]), line(p.clues[1])),
      ...p.clues.slice(2).map(line),
      `地区：美国${{ NE: '东北部', S: '南部', MW: '中西部', W: '西部' }[ans.reg]}。`,
    ];
    const options = Object.entries(S).map(([c, s]) => ({ id: c, label: s.zh, hint: c, aliases: [c] }));
    let calls = 0;
    const res = await ctx.guess({
      title: '他在哪个州长大？',
      placeholder: '输入州名（中文或缩写，如 TX）…',
      options,
      answer: p.st,
      maxGuesses: 6,
      clues,
      cluesTitle: '说话人的回答',
      columns: ['距离', '方向', '像不像'],
      near: (g, a) => haversineKm(S[g.id], S[a.id]) < 450,
      feedback: (g) => {
        calls++;
        const shown = p.clues.slice(0, visibleAnswers(calls - 1));
        const post = posterior(D, shown)[g.id];
        ctx.log('guess', { g: g.id, shown: shown.length, post: +post.toFixed(3) });
        const pct = `${Math.round(post * 100)}%`;
        const fit = { text: pct, num: true, state: post >= 0.25 ? 'hit' : post >= 0.08 ? 'near' : undefined };
        if (g.id === p.st) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, fit];
        const km = haversineKm(S[g.id], ans);
        return [{ text: fmtKm(km), num: true, state: km < 450 ? 'near' : undefined }, { text: arrow(bearingDeg(S[g.id], ans)) }, fit];
      },
    });

    const rows = p.clues.map(([q, k]) => {
      const o = Q[q].opts[k];
      const top = Object.entries(o.p).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${S[c].zh} ${v}%`).join('、');
      return { q: Q[q].zh, a: o.t, mine: `${o.p[p.st]}%`, nat: `${(o.nat * 100).toFixed(0)}%`, top };
    });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${ans.zh}（${p.st}）。最有辨识度的是占比远高于全国均值的说法：`),
      ui.table({
        columns: [{ key: 'q', label: '问题' }, { key: 'a', label: '回答' }, { key: 'mine', label: `${ans.zh}`, num: true }, { key: 'nat', label: '州均值', num: true }, { key: 'top', label: '最高的三个州' }],
        rows,
      }),
      ui.callout(`把 5 个回答合起来，${ans.zh}的可能性占 48 州的 ${Math.round(posterior(D, p.clues)[p.st] * 100)}%，全州排名第 ${p.rank}。`));
    ctx.log('done', { st: p.st, score: res.score });
    return res;
  },
};
