// #52 1828 — Noah Webster's 1828 definitions, headword blacked out; guess the word.
import { redactWord, compareWords } from './parse.js';

export default {
  meta: {
    num: 52,
    slug: '1828',
    title: '1828',
    tagline: '韦伯斯特 1828 年词典里的释义，词本身被涂黑。猜这是哪个词。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '给你一条 1828 年《美国英语词典》里的释义，词本身（及其变形）已被涂黑。',
      '从列表里选一个英文词来猜，最多 6 次；每猜错一次，多解锁一条线索（更多释义、词源、字母数、首字母）。',
      '每次猜测会告诉你：首字母是否相同、字母数差多少，以及答案在字母表中排在你的词前面还是后面。',
      '提示：两百年前的词义常常和今天不同，先别被现代意思带偏。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: "Webster's 1828 American Dictionary（CSV 转录，公有领域）", url: 'https://github.com/akaitsurugi/webster1828', note: '原书扫描见 archive.org' },
      { name: 'google-10000-english 常用词表（用于筛选常见词）', url: 'https://github.com/first20hours/google-10000-english' },
    ],
    dataNote: '谜题词取自词表第 500–7000 位、在 1828 词典中至少有 3 条编号释义的常见词；转录里偶有 OCR 小错，保持原样。',
  },

  puzzle({ data, pick }) {
    return { w: pick(data.pool).w };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const ans = ctx.data.pool.find((e) => e.w === p.w);
    const W = ans.w;
    const rd = (t) => redactWord(t, W);
    const sense = (i) => ui.h('div', ui.h('span', { class: 'mono small muted' }, `释义 ${i + 1}  `), rd(ans.senses[i]));
    const clues = [
      ui.h('div', ui.h('div', { class: 'small muted' }, '韦伯斯特 1828 的第一条释义：'), ui.quote(rd(ans.senses[0]))),
      sense(1),
      sense(2),
      ans.senses[3] ? sense(3) : `词性：${ans.pos || '（词典未标注）'}。`,
      ans.ety ? `词源注释：[${rd(ans.ety)}]` : `词性：${ans.pos || '（词典未标注）'}。`,
      `这个词有 ${W.length} 个字母：${W[0].toUpperCase()}${' _'.repeat(W.length - 1)}`,
    ];
    ctx.log('puzzle', W, 'senses', ans.senses.length);

    const options = ctx.data.options.map((w) => ({ id: w, label: w }));
    const res = await ctx.guess({
      options,
      answer: W,
      maxGuesses: 6,
      title: '这是哪个词？',
      placeholder: '输入英文单词…',
      clues,
      cluesTitle: '1828 年的释义',
      columns: ['首字母', '字母数', '字母序'],
      near: (g, a) => g.id[0] === a.id[0],
      feedback: (g, a) => {
        const c = compareWords(g.id, a.id);
        if (c.dir === '=') return [{ text: '✓', state: 'hit' }, { text: String(W.length), state: 'hit', num: true }, { text: '🎯', state: 'hit' }];
        return [
          { text: c.first ? '同' : '异', state: c.first ? 'near' : undefined },
          { text: c.len === 0 ? '相同' : c.len > 0 ? `多 ${c.len}` : `少 ${-c.len}`, state: c.len === 0 ? 'near' : undefined, num: true },
          { text: c.dir === '↓' ? '答案在后 ↓' : '答案在前 ↑' },
        ];
      },
    });

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案是 `, ui.h('b', W), `${ans.pos ? `（${ans.pos}）` : ''}。1828 年的完整释义：`),
      ui.h('ol', { style: { margin: '4px 0 0', paddingLeft: '1.3em' } }, ans.senses.map((s) => ui.h('li', s))),
      ans.ety ? ui.h('div', { class: 'small muted' }, `词源：${ans.ety}`) : null,
      ui.h('div', { class: 'small muted' }, '线索规律：1828 的释义偏重本义与具体事物（如器物、动作），许多今天最常用的引申义当时还没出现，或只排在后面。'));
    return res;
  },
};
