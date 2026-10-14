// Pure helpers: parse one 1828 HTML entry; redact the headword; score/feedback helpers.
const POS = { noun: '名词', verb: '动词', adjective: '形容词', adverb: '副词', preposition: '介词', pronoun: '代词', conjunction: '连词', interjection: '感叹词' };

export function stem(w) {
  return w.length <= 4 ? w : w.slice(0, Math.max(4, w.length - 2));
}

/** Replace the headword (and its inflections, by stem) with a black block. */
export function redactWord(text, word) {
  const s = stem(word.toLowerCase()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`\\b${s}[a-z]*`, 'gi'), '▇▇▇');
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
  if (!pos && /^To /.test(senses[0])) pos = '动词';
  return { pos, ety: ety && !/^See /i.test(ety) ? ety : null, senses };
}

/** Feedback for a guess: letters, alphabetical direction. */
export function compareWords(guess, answer) {
  const dir = guess === answer ? '=' : guess < answer ? '↓' : '↑'; // answer is later/earlier in the alphabet
  return { dir, len: guess.length - answer.length, first: guess[0] === answer[0] };
}
