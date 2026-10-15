// #45 Cognates — the same word in six languages, farthest from English first; guess the English word.
export const NAMES = { zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', he: 'Hebrew', vi: 'Vietnamese', sw: 'Swahili', fi: 'Finnish', hu: 'Hungarian', tr: 'Turkish', id: 'Indonesian',
  hi: 'Hindi', fa: 'Persian', ru: 'Russian', pl: 'Polish', cs: 'Czech', el: 'Greek', ro: 'Romanian', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', de: 'German', sv: 'Swedish', da: 'Danish' };
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
    tagline: 'The same word in six languages, farthest from English first. Guess the English word.',
    category: 'words',
    data: 'snapshot',
    howTo: [
      'The screen shows one concept written in six languages. Only the language farthest from English is revealed at first, and the first four clues never spell out the answer.',
      'Type your guess in English (the options are about 400 everyday nouns; pick from the list). Each wrong guess reveals a language closer to English.',
      'Watch for shared roots: Russian, Hindi and Persian are often related to English; French, German and Dutch are often nearly the answer.',
    ],
    scoring: '100 points for a correct 1st guess, about 17 fewer for each extra clue used, and 0 if you miss all 6.',
    sources: [
      { name: 'Wikidata multilingual labels (wbgetentities API)', url: 'https://www.wikidata.org/w/api.php?action=wbgetentities', note: 'Entry names per language, taken from English Wikipedia items' },
    ],
    dataNote: 'The Wiktionary translation tables suggested in the original idea are split by sense, and one English word often maps to several senses (bank, match), so they cannot give "the same concept" across languages without hand-picking senses. Wikidata anchors on concept items (Q numbers) with one label per language, so it is used instead. Words are lower-cased; multi-word descriptive labels, labels that collide within a language, and species names were dropped at build time. The data is a snapshot (build scripts in build/): Wikidata allows cross-origin requests, but its labels barely change day to day, and live fetching could show different players different puzzles.',
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
      options, answer: ans.en, maxGuesses: 6, title: 'What is this concept in English?', placeholder: 'Type an English word…',
      clues, cluesTitle: 'How it is written (far to near)',
    });
    const A = analyse(ans, p.langs);
    const nm = (r) => `${NAMES[r.k]} ${r.w}`;
    let why;
    if (A.g && A.g.sim >= 0.5 && (!A.r || A.g.sim >= A.r.sim)) {
      why = `Shared ancestry: ${nm(A.g)} is ${Math.round(A.g.sim * 100)}% similar to English "${ans.en}". Both are Germanic and inherited the root from a common ancestor. ` + (A.r && A.r.sim >= 0.5 ? `The Romance form ${nm(A.r)} looks alike too (probably reached English via Latin or French). ` : '');
    } else if (A.r && A.r.sim >= 0.5) {
      why = `A borrowing: ${nm(A.r)} is ${Math.round(A.r.sim * 100)}% similar to English "${ans.en}". English took this word mainly from Latin or French, so the Romance languages match best, while German and Dutch do not. `;
    } else {
      why = `This word has almost no shared ancestry: the closest Latin-script spelling is only ${Math.round(Math.max(0, ...A.rows.map((x) => x.sim ?? 0)) * 100)}% similar to English, so you had to go by meaning (the Chinese, Japanese and Korean forms, and how well you know the concept). `;
    }
    const seen = A.seen && A.seen.sim >= 0.5 ? `Among today's clues, number ${A.seen.clue} (${nm(A.seen)}) was the first to line up with the English spelling.` : 'None of today\'s 6 clues is spelled close to English, so this one was a test of meaning.';
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `The answer is ${ans.en}. Here it is in ${Object.keys(ans.l).length} languages, sorted by similarity to the English spelling:`),
      ui.callout(why + seen, 'good'),
      ui.table({ columns: [{ key: 'n', label: 'Language' }, { key: 'w', label: 'Word' }, { key: 's', label: 'Similarity', num: true }, { key: 'c', label: '#' }],
        rows: A.rows.map((x) => ({ n: NAMES[x.k], w: x.w, s: x.sim == null ? '—' : Math.round(x.sim * 100) + '%', c: x.clue ? `#${x.clue}` : '' })) }),
      ui.h('div', { class: 'small muted' }, 'Similarity = 1 − edit distance / length of the longer word (accents removed). Non-Latin scripts are not compared.'));
    return res;
  },
};
