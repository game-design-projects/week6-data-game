// #45 Cognates — the same word in six languages, farthest from English first; guess the English word.
export const NAMES = { zh: '中文', ja: '日语', ko: '韩语', ar: '阿拉伯语', he: '希伯来语', vi: '越南语', sw: '斯瓦希里语', fi: '芬兰语', hu: '匈牙利语', tr: '土耳其语', id: '印尼语',
  hi: '印地语', fa: '波斯语', ru: '俄语', pl: '波兰语', cs: '捷克语', el: '希腊语', ro: '罗马尼亚语', fr: '法语', es: '西班牙语', it: '意大利语', pt: '葡萄牙语', nl: '荷兰语', de: '德语', sv: '瑞典语', da: '丹麦语' };
export const TIERS = [
  ['zh', 'ja', 'ko', 'ar', 'he', 'vi', 'sw', 'fi', 'hu', 'tr', 'id'], // far from English
  ['hi', 'fa', 'ru', 'pl', 'cs', 'el', 'ro'],                        // distant Indo-European
  ['fr', 'es', 'it', 'pt', 'nl', 'de', 'sv', 'da'],                   // close
];

const GERMANIC = ['de', 'nl', 'sv', 'da'];
const ROMANCE = ['fr', 'es', 'it', 'pt', 'ro'];
const ALIASES = { color: ['colour'], theatre: ['theater'], aunt: ['auntie'], television: ['tv'], telephone: ['phone'], photograph: ['photo'], bicycle: ['bike'], whisky: ['whiskey'] };

/** Lowercase, strip accents, keep only letters. */
export function norm(s) { return s.replace(/ø/g, 'o').replace(/đ/g, 'd').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/ł/g, 'l').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\u0370-\u1fff\u3040-\u9fff\uac00-\ud7af\u0400-\u04ff\u0590-\u06ff\u0900-\u097f]/g, ''); }

/** Levenshtein-based 0..1 similarity between a label and the English word; null if the label is not Latin script. */
export function similarity(label, en) {
  const a = norm(label), b = norm(en);
  if (!a || !/^[a-z]+$/.test(a)) return null;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

/** Would showing this label this early give the answer away? (identical, or contains the English word) */
export function leaky(label, en) {
  const a = norm(label);
  return a === en || (en.length >= 4 && a.includes(en)) || (similarity(label, en) ?? 0) >= 0.8;
}

/** Pick 2 languages from each tier that the concept has, ordered far -> near.
 *  The two far tiers never show a word that already spells the English answer. */
export function pickLangs(concept, rng) {
  return TIERS.flatMap((t, i) => {
    const have = t.filter((k) => concept.l[k]);
    const safe = i < 2 && concept.en ? have.filter((k) => !leaky(concept.l[k], concept.en)) : have;
    return rng.sample(safe.length >= 2 ? safe : have, 2);
  });
}

/** Learnable part: which written forms resemble the English word, and which family they belong to. */
export function analyse(concept, langs) {
  const rows = TIERS.flat().filter((k) => concept.l[k]).map((k) => ({ k, w: concept.l[k], sim: similarity(concept.l[k], concept.en), clue: langs.indexOf(k) + 1 }));
  rows.sort((x, y) => (y.sim ?? -1) - (x.sim ?? -1));
  const best = (ks) => rows.filter((r) => ks.includes(r.k) && r.sim != null).sort((x, y) => y.sim - x.sim)[0];
  const g = best(GERMANIC), r = best(ROMANCE);
  const near = rows.filter((x) => x.sim != null && x.sim >= 0.5);
  const seen = rows.filter((x) => x.clue && x.sim != null).sort((x, y) => y.sim - x.sim)[0];
  return { rows, g, r, near, seen };
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
      '屏幕上是同一个概念在六种语言里的写法，一开始只露出和英语最远的那一种；前四种不会直接拼出答案。',
      '输入你猜的英文单词（候选是约 400 个日常名词，从列表里选）。每猜错一次，就多揭示一种更接近英语的语言。',
      '留意相同的词根：俄语、印地语、波斯语常与英语同源；法语、德语、荷兰语往往几乎就是答案。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一条线索少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'Wikidata 多语言标签（wbgetentities API）', url: 'https://www.wikidata.org/w/api.php?action=wbgetentities', note: '按英文维基条目取各语言的词条名' },
    ],
    dataNote: '想法里建议的 Wiktionary 翻译表按词义分段、一个英文词常对应多个义项（如 bank、match），无法在不人工选义项的情况下得到“同一个概念”的各语言词形；Wikidata 以概念条目（Q 编号）为锚，每个条目在各语言里只有一个标签，所以改用它。词形已转小写；多词的概念性标签、同一语言里撞车的标签、动植物学名已在构建时剔除。数据为快照（构建脚本见 build/），Wikidata 的 API 虽支持跨域，但标签库每天变动极小，实时抓取不会让题目更好，反而可能让不同玩家看到不同题目。',
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
    const options = ctx.data.concepts.map((c) => ({ id: c.en, label: c.en, aliases: ALIASES[c.en] || [] }));
    const res = await ctx.guess({
      options, answer: ans.en, maxGuesses: 6, title: '这个概念的英文是？', placeholder: '输入英文单词…',
      clues, cluesTitle: '各语言的写法（由远及近）',
    });
    const A = analyse(ans, p.langs);
    const nm = (r) => `${NAMES[r.k]} ${r.w}`;
    let why;
    if (A.g && A.g.sim >= 0.5 && (!A.r || A.g.sim >= A.r.sim)) {
      why = `同源痕迹：${nm(A.g)} 与英文 ${ans.en} 相似度 ${Math.round(A.g.sim * 100)}%，它们同属日耳曼语族，从共同祖先继承了这个词根。` + (A.r && A.r.sim >= 0.5 ? `罗曼语里的 ${nm(A.r)} 也很像（多半经拉丁语/法语进入英语）。` : '');
    } else if (A.r && A.r.sim >= 0.5) {
      why = `借词痕迹：${nm(A.r)} 与英文 ${ans.en} 相似度 ${Math.round(A.r.sim * 100)}%——英语的这个词主要来自拉丁语/法语，所以罗曼语最像，而德语、荷兰语反而不像。`;
    } else {
      why = `这个词几乎没有同源痕迹：拉丁字母的写法里最像英文的也只有 ${Math.round(Math.max(0, ...A.rows.map((x) => x.sim ?? 0)) * 100)}%，只能靠词义（中日韩的写法、你对这个概念的熟悉程度）来推断。`;
    }
    const seen = A.seen && A.seen.sim >= 0.5 ? `今天的线索里，第 ${A.seen.clue} 条（${nm(A.seen)}）是第一个能直接对上英文拼写的。` : '今天的 6 条线索里没有一条拼写接近英文，是一道考词义的题。';
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案是 ${ans.en}。它在 ${Object.keys(ans.l).length} 种语言里的写法如下（按与英文拼写的相似度排序）：`),
      ui.callout(why + seen, 'good'),
      ui.table({ columns: [{ key: 'n', label: '语言' }, { key: 'w', label: '写法' }, { key: 's', label: '相似度', num: true }, { key: 'c', label: '线索' }],
        rows: A.rows.map((x) => ({ n: NAMES[x.k], w: x.w, s: x.sim == null ? '—' : Math.round(x.sim * 100) + '%', c: x.clue ? `第 ${x.clue} 条` : '' })) }),
      ui.h('div', { class: 'small muted' }, '相似度 = 1 − 编辑距离 / 较长词的长度（去掉重音符号后比较），非拉丁字母不比较。'));
    return res;
  },
};
