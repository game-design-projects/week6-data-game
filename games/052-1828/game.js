// #52 1828 — Noah Webster's 1828 definitions, headword blacked out; guess the word.
import { redactWord, compareWords, clueSpecs, analyze } from './parse.js';

export default {
  meta: {
    num: 52,
    slug: '1828',
    title: '1828',
    tagline: 'Definitions from Webster\'s 1828 dictionary with the word itself blacked out. Guess the word.',
    category: 'words',
    data: 'snapshot',
    howTo: [
      'You get a definition from the 1828 American Dictionary of the English Language, with the word itself (and its variants) blacked out.',
      'Pick an English word from the list (every headword in the 1828 dictionary is guessable), up to 6 guesses. Each miss unlocks a clue: more definitions, part of speech, etymology, and finally the letter count and first letter.',
      'Each guess tells you whether the first letter matches, how the letter counts differ, and whether the answer comes before or after your word alphabetically.',
      'Tip: word meanings two centuries ago often differ from today\'s, so do not be led astray by the modern sense.',
    ],
    scoring: '100 points for a correct 1st guess, about 17 fewer for each extra guess, and 0 if you miss all 6.',
    sources: [
      { name: "Webster's 1828 American Dictionary (CSV transcription, public domain)", url: 'https://github.com/akaitsurugi/webster1828', note: 'Scans of the original book are on archive.org' },
      { name: 'google-10000-english word list (used to pick common words)', url: 'https://github.com/first20hours/google-10000-english' },
    ],
    dataNote: 'Puzzle words are common words ranked 500-7,000 in the frequency list that have at least 3 numbered senses in the 1828 dictionary (150 puzzles). The dictionary is a fixed text from 1828 with no daily source, so an offline snapshot is used. The guessable list is every single-word headword in the dictionary (about 57,000). The black bars cover the answer and its variants, and the whole pool was checked so no near-form slips through. The transcription has occasional OCR slips, left as is.',
  },

  puzzle({ data, pick }) {
    return { w: pick(data.pool).w };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const ans = ctx.data.pool.find((e) => e.w === p.w);
    const W = ans.w;
    const rd = (t) => redactWord(t, W);
    const sense = (i) => ui.h('div', ui.h('span', { class: 'mono small muted' }, `Sense ${i + 1}  `), rd(ans.senses[i]));
    const posLine = `Part of speech: ${ans.pos}.`;
    const clues = clueSpecs(ans).map((c, k) => {
      if (c.t === 's') return k === 0
        ? ui.h('div', ui.h('div', { class: 'small muted' }, 'Webster 1828, first sense:'), ui.quote(rd(ans.senses[0])))
        : sense(c.i);
      if (c.t === 'pos') return posLine;
      if (c.t === 'ety') return `Etymology note: [${rd(ans.ety)}]`;
      if (c.t === 'sn') return `The dictionary gives it ${ans.senses.length} numbered senses.`;
      return `The word has ${W.length} letters: ${W[0].toUpperCase()}${' _'.repeat(W.length - 1)}`;
    });
    ctx.log('puzzle', W, 'senses', ans.senses.length);

    const options = ctx.data.words.split(' ').map((w) => ({ id: w, label: w }));
    ctx.log('options', options.length);
    const res = await ctx.guess({
      options,
      answer: W,
      maxGuesses: 6,
      title: 'Which word is this?',
      placeholder: 'Type an English word…',
      clues,
      cluesTitle: 'Definitions from 1828',
      columns: ['First', 'Length', 'Order'],
      near: (g, a) => g.id[0] === a.id[0],
      feedback: (g, a) => {
        const c = compareWords(g.id, a.id);
        if (c.dir === '=') return [{ text: '✓', state: 'hit' }, { text: String(W.length), state: 'hit', num: true }, { text: '🎯', state: 'hit' }];
        return [
          { text: c.first ? 'Same' : 'Diff', state: c.first ? 'near' : undefined },
          { text: c.len === 0 ? 'Same' : c.len > 0 ? `+${c.len}` : `\u2212${-c.len}`, state: c.len === 0 ? 'near' : undefined, num: true },
          { text: c.dir === '↓' ? 'later \u2193' : 'earlier \u2191' },
        ];
      },
    });

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, 'The answer is ', ui.h('b', W), ` (${ans.pos}). The full 1828 definition:`),
      ui.h('ol', { style: { margin: '4px 0 0', paddingLeft: '1.3em' } }, ans.senses.map((s) => ui.h('li', s))),
      ans.ety ? ui.h('div', { class: 'small muted' }, `Etymology: ${ans.ety}`) : null,
      ui.h('div', { class: 'small' }, ui.h('b', 'What gave it away:'), ui.h('ul', { style: { margin: '2px 0 0', paddingLeft: '1.3em' } }, analyze(ans).map((t) => ui.h('li', t)))));
    return res;
  },
};
