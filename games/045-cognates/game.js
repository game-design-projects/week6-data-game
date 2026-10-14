// #45 Cognates — the same word in six languages, farthest from English first; guess the English word.
export const NAMES = { zh: '中文', ja: '日语', ko: '韩语', ar: '阿拉伯语', he: '希伯来语', vi: '越南语', sw: '斯瓦希里语', fi: '芬兰语', hu: '匈牙利语', tr: '土耳其语', id: '印尼语',
  hi: '印地语', fa: '波斯语', ru: '俄语', pl: '波兰语', cs: '捷克语', el: '希腊语', ro: '罗马尼亚语', fr: '法语', es: '西班牙语', it: '意大利语', pt: '葡萄牙语', nl: '荷兰语', de: '德语', sv: '瑞典语', da: '丹麦语' };
export const TIERS = [
  ['zh', 'ja', 'ko', 'ar', 'he', 'vi', 'sw', 'fi', 'hu', 'tr', 'id'], // far from English
  ['hi', 'fa', 'ru', 'pl', 'cs', 'el', 'ro'],                        // distant Indo-European
  ['fr', 'es', 'it', 'pt', 'nl', 'de', 'sv', 'da'],                   // close
];

/** Pick 2 languages from each tier that the concept has, ordered far -> near. */
export function pickLangs(concept, rng) {
  return TIERS.flatMap((t) => rng.sample(t.filter((k) => concept.l[k]), 2));
}

export default {
  meta: {
    num: 45,
    slug: 'cognates',
    title: 'Cognates',
    tagline: '同一个词在六种语言里的写法，从最远的语言开始揭示，猜英文。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '屏幕上是同一个概念在六种语言里的写法，一开始只露出和英语最远的那一种。',
      '输入你猜的英文单词（从列表里选）。每猜错一次，就多揭示一种更接近英语的语言。',
      '留意相同的词根：俄语、印地语、波斯语常与英语同源；法语、德语、荷兰语往往几乎就是答案。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一条线索少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'Wikidata 多语言标签（wbgetentities API）', url: 'https://www.wikidata.org/w/api.php?action=wbgetentities', note: '按英文维基条目取各语言的词条名' },
    ],
    dataNote: '原想用 Wiktionary 翻译表，但其结构不统一；这里改用 Wikidata 的多语言标签，同样是各语言社区编辑的真实词形。词形已转小写；部分词条名可能带有概念性而非日常用词的色彩。',
  },

  puzzle({ data, pick, rng }) {
    const c = pick(data.concepts);
    return { en: c.en, langs: pickLangs(c, rng) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const ans = ctx.data.concepts.find((c) => c.en === p.en);
    ctx.log('cognates puzzle', p.en, p.langs.join(','));
    const clue = (k) => ui.h('div', { class: 'ds-row', style: { alignItems: 'baseline', gap: '10px' } },
      ui.h('span', { class: 'small muted', style: { minWidth: '5.5em' } }, NAMES[k]),
      ui.h('span', { style: { fontSize: '1.5em', fontWeight: '600' } }, ans.l[k]));
    const clues = p.langs.map((k) => () => clue(k));
    const options = ctx.data.concepts.map((c) => ({ id: c.en, label: c.en }));
    const res = await ctx.guess({
      options, answer: ans.en, maxGuesses: 6, title: '这个概念的英文是？', placeholder: '输入英文单词…',
      clues, cluesTitle: '各语言的写法（由远及近）',
    });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案是 ${ans.en}。下面是它在 ${Object.keys(ans.l).length} 种语言里的写法，对比看看哪些和英语同源：`),
      ui.table({ columns: [{ key: 'n', label: '语言' }, { key: 'w', label: '写法' }],
        rows: TIERS.flat().filter((k) => ans.l[k]).map((k) => ({ n: NAMES[k] + (p.langs.includes(k) ? ' ✓' : ''), w: ans.l[k] })) }),
      ui.h('div', { class: 'small muted' }, `✓ 为今天出现的线索。英语与德语、荷兰语、北欧语言同属日耳曼语族，所以这些词形往往最像；法语等罗曼语常来自拉丁语，也大量进入了英语词汇。`));
    return res;
  },
};
