// Shared by build.mjs and the tests: title genericising and name-leak helpers.

/** Generic rank vocabulary. Anything else (demonyms, places, dynasties, odd offices) is dropped so no title can leak. */
export const RANKS = [
  [/consort/i, 'Consort'],
  [/grand (duke|duchess)/i, 'Grand Duke'],
  [/archdu(ke|chess)/i, 'Archduke'],
  [/crown prince/i, 'Crown Prince'],
  [/elector/i, 'Elector'],
  [/king-emperor|\bking\b|\bqueen\b/i, null], // resolved below (king vs queen)
  [/empress/i, 'Empress'],
  [/emperor|\bkaiser\b|basileus|padishah|padshah/i, 'Emperor'],
  [/tsar(?!e)|czar/i, 'Tsar'],
  [/shah\b/i, 'Shah'],
  [/sultan/i, 'Sultan'],
  [/caliph/i, 'Caliph'],
  [/pharaoh/i, 'Pharaoh'],
  [/negus/i, 'Negus'],
  [/\bkhan\b/i, 'Khan'],
  [/regent/i, 'Regent'],
  [/\bdoge\b/i, 'Doge'],
  [/margrave/i, 'Margrave'],
  [/landgrave/i, 'Landgrave'],
  [/\bduke\b/i, 'Duke'],
  [/duchess/i, 'Duchess'],
  [/count palatine|\bcount\b/i, 'Count'],
  [/countess/i, 'Countess'],
  [/princess/i, 'Princess'],
  [/\bprince\b|tsarevich|tsesarevich/i, 'Prince'],
  [/viscount/i, 'Viscount'],
  [/marquess/i, 'Marquess'],
  [/voivode|knyaz|stadtholder|satrap/i, null],
  [/pretender/i, 'Pretender'],
];
const SKIP = /aga khan|imam|ancient|senator|ambassador|cardinal|quaestor|royal highness|steward/i;
export const RANK_WORDS = new Set([...RANKS.map((r) => r[1]).filter(Boolean), 'King', 'Queen']);
const HAS_PLACE = /\b(of|de|du|des|von|van)\b|d'/i;

/** "King of England" -> "King of ▇▇▇"; "Mughal emperor" -> "Emperor"; "Chinese king" -> "King"; unknown -> null. */
export function redactTitle(t) {
  if (!t || SKIP.test(t)) return null;
  let rank = null;
  for (const [re, name] of RANKS) {
    if (!re.test(t)) continue;
    if (name) rank = name;
    else if (/\bqueen\b/i.test(t) && !/\bking\b/i.test(t)) rank = 'Queen';
    else if (/\bking\b|king-emperor/i.test(t)) rank = 'King';
    break;
  }
  if (!rank) return null;
  return HAS_PLACE.test(t) ? `${rank} of ▇▇▇` : rank;
}

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Words that identify a house: "House of Orange-Nassau" -> ["orange", "nassau"]. */
export function houseTokens(name) {
  return strip(name).replace(/\b(house|of|dynasty|clan|the|imperial|capetian|denmark)\b/g, ' ')
    .split(/[^a-z]+/).filter((w) => w.length >= 2);
}
const PARTICLE = /^(abd|al|el|bin|bint|ibn|abu|de|di|da|van|von|of|the|saint|st|sultan|shah|king|queen|prince|princess|duke|duchess|count|countess|emperor|empress|lord|sir|lady|infante|infanta|archduke|archduchess|grand|margrave|duc|don|dona|ben|patriarch|pope|bishop|cardinal|tsar|tsarevich|tsesarevich|tsarina|pharaoh|baron|baroness|landgrave|elector|regent|queen-consort)$/i;
/** First real given name of a full name, or '' when it would leak the house or is just a particle. */
export function givenName(full, tokens) {
  const w = full.replace(/\(.*?\)/g, '').replace(/,.*$/, '').trim().split(/[\s-]+/).filter((x) => x && !PARTICLE.test(x))[0] || '';
  if (w.length < 3) return '';
  const s = strip(w);
  if (tokens.some((t) => t.length >= 3 && (s.includes(t) || t.includes(s)))) return '';
  return w;
}
