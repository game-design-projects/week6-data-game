// #46 First Use — guess the year a word first appeared in written English (Online Etymology Dictionary dates).
export const MIN_YEAR = 1500;
export const MAX_YEAR = 2020;

/** Free zone (years): exact-year entries ±2, decade entries ("1560s") cover the whole decade (±5 around the midpoint). */
export const freeZone = (item) => (item.d ? 5 : 2);

/** Score 0..1: full marks inside the free zone, then decays with the error (scale 60 years). */
export function yearScore(guess, answer, free = 2, scale = 60) {
  const err = Math.max(0, Math.abs(guess - answer) - free);
  return Math.exp(-err / scale);
}

/** "1560s" for decade entries, "1862" for exact ones. */
export const fmtYear = (item) => (item.d ? `${item.y - 5}s` : String(item.y));

const IBERIAN = /Spanish|Portuguese|Nahuatl|Carib|Arawak/;
const CLASSICAL = /Latin|Greek/;

/** One sentence tying this puzzle's origin language and date to a general pattern in how English grew. */
export function pattern(item) {
  const { o, y } = item;
  if (IBERIAN.test(o) && y < 1800) return 'Spanish and Portuguese ships carried crops and goods from the Americas and Asia to Europe, and their names came into English with them. Words like this cluster in the 16th and 17th centuries.';
  if (/Italian/.test(o)) return y < 1700 ? 'Renaissance Italy poured science, architecture, music and seafaring vocabulary into English, peaking in the 16th and 17th centuries.' : 'From the 18th century, British travelers who toured Italy brought home Italian words for music, food and travel.';
  if (/French/.test(o)) return y < 1700 ? 'French has long been English\u2019s biggest lender, and the 16th and 17th centuries brought another wave of scholarly, courtly and military words.' : 'Words borrowed from French in the 18th and 19th centuries mostly concern fashion, dining, diplomacy and the arts.';
  if (CLASSICAL.test(o)) return y < 1700 ? 'Renaissance scholars lifted words straight from Latin and Greek, so academic and medical vocabulary appears in bulk in the 16th and 17th centuries.' : y < 1900 ? 'In the 19th century the sciences multiplied, and new fields and substances were usually named with Latin or Greek roots.' : 'New 20th-century medical and chemical terms were still built from Latin and Greek roots.';
  if (/German|Dutch|Norwegian|Old Norse/.test(o)) return y < 1700 ? 'Sailing, trade and war brought words from the Low Countries and Scandinavia into English, mostly about ships, money and everyday goods.' : 'In the 19th and 20th centuries German supplied English with a great many terms in chemistry, psychology and medicine.';
  if (/Japanese/.test(o)) return 'Japanese loanwords trickle in from the 18th century, and only multiply after the country opened to trade in the late 19th century; modern pop-culture words came later still.';
  if (/Hindi|Sanskrit/.test(o)) return 'Under the East India Company and the Raj (18th and 19th centuries), Indian religious and everyday words were borrowed into English.';
  if (/West African/.test(o)) return 'Words from African languages mostly entered English through slave societies in the Caribbean and the American South, and often reached print only in the 19th century.';
  if (/unknown/.test(o)) return 'Slang and spoken words of unknown origin usually appear in print long after people started saying them, so the shape of the word tells you little; guess from the thing it names and the register.';
  if (/person/.test(o)) return 'A thing named after a person usually gets its name within the decades when that person was active.';
  if (y >= 1950) return 'Postwar technology (electronics, computing, networks) coins new words through compounds, acronyms and brand names, almost all from the second half of the 20th century.';
  if (y >= 1900) return 'New inventions and mass culture of the early 20th century (transport, film, radio, nutrition) quickly produced words by blending and clipping.';
  if (y >= 1800) return 'The new things and leisure habits of the Industrial Revolution were often named by joining or shortening existing English words.';
  return 'Words like this are built inside English by compounding, derivation or clipping rather than borrowed, so the date mostly follows the arrival of the thing they name.';
}

export default {
  meta: {
    num: 46,
    slug: 'first-use',
    title: 'First Use',
    tagline: 'Here is an English word and its meaning. Guess the year it first appeared in written English.',
    category: 'words',
    data: 'snapshot',
    howTo: [
      'You see an English word, a short definition and the language it came from. Think about when the thing itself came into being and which language lent the word.',
      'Drag the slider or type a year (1500\u20132020). You get up to 3 tries, with an \u201cearlier\u201d or \u201clater\u201d hint after each.',
      'For older words the dictionary only records a decade (\u201c1560s\u201d); anywhere in that decade counts as a hit. For the rest, within 2 years counts as a hit.',
      'Scoring: a hit earns full marks, then the score drops to about 37% for every 60 years off; each extra try costs 10%.',
    ],
    scoring: '100 \u00d7 e^(\u2212(|error| \u2212 tolerance)/60), with a tolerance of 2 years (the whole decade for decade-only entries); each extra try costs 10%.',
    sources: [
      { name: 'Online Etymology Dictionary (etymonline.com)', url: 'https://www.etymonline.com/', note: 'the year that opens each entry is the earliest written evidence of the word (in that sense)' },
      { name: 'yosevu/etymonline (GitHub mirror of the entries)', url: 'https://github.com/yosevu/etymonline', note: 'this game uses its index.json' },
    ],
    dataNote: 'We wanted Merriam-Webster\u2019s First Known Use, but it has no open API and forbids scraping, so we use the first year in each Online Etymology Dictionary entry. 130 words with clear, stable meanings were hand-picked from the etymonline data, and the short definitions are hand-written. Entries before 1500 are only dated to the century (\u201clate 14c.\u201d), which cannot make a guess-the-year puzzle, so they are left out. A few years may differ from MW or the OED by a few years; dictionaries disagree on what counts as earliest.',
  },

  puzzle({ data, pick }) {
    const x = pick(data.words);
    return { w: x.w, gloss: x.gloss, p: x.p, y: x.y, d: x.d, o: x.o, ex: x.ex };
  },

  async play(ctx, item) {
    const { ui, core } = ctx;
    ctx.log('word', item.w, item.y, item.d ? 'decade' : 'exact', item.o);
    const POS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };

    ctx.stage.append(ui.panel({ kicker: 'English word', title: item.w },
      ui.h('p', { class: 'ink2' }, `${POS[item.p] ? POS[item.p] + ' \u00b7 ' : ''}${item.gloss}`),
      ui.h('div', { class: 'ds-row' }, ui.badge(`Origin: ${item.o}`), ui.badge(`${item.w.length} letters`))));

    const res = await ctx.estimate({
      title: 'In what year did it first appear?',
      answer: item.y, min: MIN_YEAR, max: MAX_YEAR, step: 1, initial: 1800,
      format: (v) => String(Math.round(v)),
      attempts: 3, tolerance: freeZone(item),
      scoring: (g, a) => yearScore(g, a, freeZone(item)),
    });

    const same = ctx.data.words.filter((x) => x.w !== item.w && Math.abs(x.y - item.y) <= 20).slice(0, 5);
    res.detail = ui.kv([
      ['Answer', `${item.w} (${item.gloss}): ${fmtYear(item)}${item.d ? ' (the dictionary only dates it to the decade)' : ''}`],
      ['Pattern', pattern(item)],
      ['Entry', item.ex],
      ['Same era', same.length ? same.map((x) => `${x.w} (${x.d ? `${x.y - 5}s` : x.y})`).join(', ') : '\u2014'],
    ]);
    ctx.log('result', res.score, res.guess);
    return res;
  },
};
