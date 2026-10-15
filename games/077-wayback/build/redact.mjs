// Shared redaction helpers: brand names, domains and year numbers are scrubbed offline.
export const BAR = '▇▇▇';
export const YEAR_BAR = '▇▇▇▇';
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ \-]+/g, '[\\s\\-]*');
export function makeRedactor([id, name, dom, extra]) {
  const base = dom.split('.')[0].replace(/-/g, '');
  const words = [...new Set([base, dom, name.replace(/[^\w ]/g, '').trim(), ...extra].filter((w) => w && w.length >= 2))]
    .sort((a, b) => b.length - a.length);
  const long = words.filter((w) => w.length >= 5), all = words.map(esc).join('|');
  // 1) whole word (Yahoo! keeps its "!"); long names also swallow suffixes (Googles, googleads)
  const re = new RegExp(`(?<![A-Za-z0-9])(?:${long.length ? long.map(esc).join('|') + '|' : ''}${all})(?:!|(?![A-Za-z0-9]))|(?<![A-Za-z0-9])(?:${long.map(esc).join('|') || '(?!)'})[A-Za-z]*`, 'gi');
  // 2) short names as an UPPERCASE run glued to other text (CNNtoGO) — never inside "submit"/"groups"
  const reUp = new RegExp(`(?<![A-Z])(?:${words.filter((w) => w.length < 5).map((w) => esc(w.toUpperCase())).join('|') || '(?!)'})(?![A-Z])`, 'g');
  // 3) CamelCase glue (KidsPost, PostGlobal, myYahoo): capitalised name word touching another word
  const caps = words.filter((w) => w.length >= 4 && !w.includes('.')).map((w) => esc(w[0].toUpperCase() + w.slice(1)));
  const reCamel = new RegExp(caps.length ? `(?<=[a-z])(?:${caps.join('|')})(?![a-z])|(?<![A-Za-z])(?:${caps.join('|')})(?=[A-Z])` : '(?!)', 'g');
  const dom_ = /\b(?:www\d?\.)?[\w-]+\.(?:com|org|net|edu|gov|co\.uk)\b/gi; // any domain-looking token
  const yr = /(?<![\d.])(?:19[89]\d|20[0-2]\d)(?![\d])/g;
  const red = (s) => s.replace(re, BAR).replace(reUp, BAR).replace(reCamel, BAR).replace(dom_, BAR).replace(yr, YEAR_BAR);
  red.re = [re, reUp, reCamel];
  return red;
}
