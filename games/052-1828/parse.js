// Pure helpers: parse one 1828 HTML entry; redact the headword; score/feedback helpers.
const POS = { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', preposition: 'preposition', pronoun: 'pronoun', conjunction: 'conjunction', interjection: 'interjection' };

export function stem(w) {
  return w.length <= 4 ? w : w.slice(0, Math.max(4, w.length - 2));
}

const SUFFIXES = ['ation', 'ing', 'ion', 'ern', 'ment', 'ness', 'able', 'less', 'ity', 'ive', 'ous', 'ant', 'ent', 'ance', 'ence', 'ful', 'ic', 'al', 'ly', 'ed', 'er'];
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex source fragments that match the headword and its likely derived forms. */
export function redactPatterns(word) {
  const w = word.toLowerCase();
  const pats = new Set([`${esc(stem(w))}[a-z]*`]);
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) pats.add(`${esc(w.slice(0, -suf.length))}[a-z]*`);
  }
  if (w.endsWith('e') && w.length - 1 >= 3) pats.add(`${esc(w.slice(0, -1))}(?:ing|ings|ed|er|ers|ation|ations)`);
  if (w.endsWith('y') && w.length >= 4) pats.add(`${esc(w.slice(0, -1))}i[a-z]*`);
  return [...pats];
}

/** Replace the headword (and its inflections / derivations) with a black block. */
export function redactWord(text, word) {
  return text.replace(new RegExp(`\\b(?:${redactPatterns(word).join('|')})`, 'gi'), '▇▇▇');
}

/** Words still visible after redaction that start like the answer (≥ 5 letters or the whole word). */
export function leakTokens(text, word) {
  const w = word.toLowerCase();
  const k = Math.min(5, w.length);
  return (redactWord(text, w).toLowerCase().match(/[a-z]{4,}/g) || []).filter((t) => t.slice(0, k) === w.slice(0, k));
}

/** Which clues unlock, in order. Every slot is distinct. */
export function clueSpecs(e) {
  const s = [{ t: 's', i: 0 }, { t: 's', i: 1 }, { t: 's', i: 2 }];
  if (e.senses[3]) {
    s.push({ t: 's', i: 3 }, e.ety ? { t: 'ety' } : { t: 'pos' });
  } else {
    s.push({ t: 'pos' }, e.ety ? { t: 'ety' } : { t: 'sn' });
  }
  s.push({ t: 'letters' });
  return s;
}

const list = (a) => a.map((x) => `\u201c${x}\u201d`).join(', ');

/** Specific, per-word explanation of what in the entry gave the word away (English strings; uses unredacted text). */
export function analyze(e) {
  const out = [];
  const first = e.senses[0];
  const segs = first.split(/;\s*/).map((x) => x.replace(/[.,]$/, '').trim());
  const syn = segs.filter((x) => /^[A-Za-z-]+( [A-Za-z-]+)?$/.test(x) && !/^(as|a|an|the|to)$/i.test(x)).slice(0, 4);
  if (syn.length >= 2) out.push(`Sense 1 lists near-synonyms separated by semicolons (${list(syn)}); together they circle the core meaning.`);
  const ex = e.senses.map((x) => x.match(/\bas,?\s+([^;]{8,70})/i)).find(Boolean);
  if (ex) out.push(`The example \u201c${ex[1].replace(/\.$/, '')}\u201d in the definition shows a typical 1828 usage.`);
  if (/^to\b/i.test(first)) out.push('Sense 1 starts with \u201cTo\u201d, the classic form of a verb definition.');
  else if (e.pos === 'noun' && /^(a|an|the)\b/i.test(first)) out.push('Sense 1 starts with an article, the classic form of a noun definition (a kind of thing).');
  if (e.ety) out.push(`The etymology note \u201c${e.ety}\u201d says where it comes from.`);
  if (!out.length) out.push(`The dictionary lists ${e.senses.length} senses for it; start with the most concrete, literal one.`);
  out.push(`${e.senses.length} senses in all: later senses tend to be more abstract and closer to today's extended meanings.`);
  return out;
}

const clean = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

/** → { pos, ety, senses[] } or null when the entry is not a clean headword entry. */
export function parseEntry(html, word) {
  const paras = [...html.matchAll(/<p>(.*?)<\/p>/gs)].map((m) => m[1]);
  if (!paras.length) return null;
  const head = paras[0];
  const hw = (head.match(/<b>([^<]*)<\/b>/) || [])[1] || '';
  if (hw.replace(/[^A-Za-z]/g, '').toLowerCase() !== word) return null;
  const posRaw = (head.match(/<i>([a-z]+)<\/i>/) || [])[1];
  let pos = POS[posRaw] || null;
  const ety = (clean(head).match(/\[([^\]]{4,160})\]/) || [])[1] || null;
  const senses = [];
  for (const p of paras) {
    const m = p.match(/^<b>\d+\.<\/b>\s*(.*)$/s);
    if (m) senses.push(clean(m[1]));
  }
  if (!senses.length) return null;
  if (!pos && /^To /.test(senses[0])) pos = 'verb';
  return { pos, ety: ety && !/^See /i.test(ety) ? ety : null, senses };
}

/** Feedback for a guess: letters, alphabetical direction. */
export function compareWords(guess, answer) {
  const dir = guess === answer ? '=' : guess < answer ? '↓' : '↑'; // answer is later/earlier in the alphabet
  return { dir, len: guess.length - answer.length, first: guess[0] === answer[0] };
}
