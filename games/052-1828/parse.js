// Pure helpers: parse one 1828 HTML entry; redact the headword; score/feedback helpers.
const POS = { noun: '名词', verb: '动词', adjective: '形容词', adverb: '副词', preposition: '介词', pronoun: '代词', conjunction: '连词', interjection: '感叹词' };

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

const list = (a) => a.map((x) => `“${x}”`).join('、');

/** Specific, per-word explanation of what in the entry gave the word away (Chinese strings; uses unredacted text). */
export function analyze(e) {
  const out = [];
  const first = e.senses[0];
  const segs = first.split(/;\s*/).map((x) => x.replace(/[.,]$/, '').trim());
  const syn = segs.filter((x) => /^[A-Za-z-]+( [A-Za-z-]+)?$/.test(x) && !/^(as|a|an|the|to)$/i.test(x)).slice(0, 4);
  if (syn.length >= 2) out.push(`释义 1 用分号并列了近义词 ${list(syn)}，它们圈出了这个词的核心意思。`);
  const ex = e.senses.map((x) => x.match(/\bas,?\s+([^;]{8,70})/i)).find(Boolean);
  if (ex) out.push(`释义里的用例“${ex[1].replace(/\.$/, '')}”展示了它在 1828 年的典型搭配。`);
  if (/^to\b/i.test(first)) out.push('释义 1 以 “To” 开头，是动词的典型写法。');
  else if (e.pos === '名词' && /^(a|an|the)\b/i.test(first)) out.push('释义 1 以冠词开头，是名词（某种事物）的典型写法。');
  if (e.ety) out.push(`词源注释“${e.ety}”交代了它的来源。`);
  if (!out.length) out.push(`词典为它列了 ${e.senses.length} 条释义，先看最具体的本义。`);
  out.push(`共 ${e.senses.length} 条释义：越靠后的释义往往越抽象、越接近今天的引申义。`);
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
  if (!pos && /^To /.test(senses[0])) pos = '动词';
  return { pos, ety: ety && !/^See /i.test(ety) ? ety : null, senses };
}

/** Feedback for a guess: letters, alphabetical direction. */
export function compareWords(guess, answer) {
  const dir = guess === answer ? '=' : guess < answer ? '↓' : '↑'; // answer is later/earlier in the alphabet
  return { dir, len: guess.length - answer.length, first: guess[0] === answer[0] };
}
