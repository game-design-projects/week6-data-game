// Pure helpers shared by build.mjs and the tests.
const TYPE_MAP = [
  [/^Airbus (A3\d\d)neo$/, 'Airbus $1'],
  [/^Boeing 737 MAX$/, 'Boeing 737'],
  [/^Beechcraft 1900D?$/, 'Beechcraft 1900'],
  [/^McDonnell Douglas MD-11.*$/, 'McDonnell Douglas MD-11'],
  [/^CRJ(100|200)$/, 'CRJ100/200'],
  [/^Embraer 190-E2$/, 'Embraer 190'],
  [/^De Havilland Canada DHC-8-\d+$/, 'De Havilland Canada Dash 8'],
];
export const normType = (t) => { t = t.trim(); for (const [re, to] of TYPE_MAP) if (re.test(t)) return t.replace(re, to); return t; };
export const normOp = (o) => o.trim().replace(/^the /i, '');
/** Brand key: ops with the same key look alike (Lufthansa / Lufthansa Cargo, Air Canada / Air Canada Rouge). */
export function opBrand(op) {
  const w = op.split(/\s+/);
  if (w[0] === 'Air' || w[0] === 'Eastern' || w[0] === 'Western' || w[0] === 'Hong' || w[0] === 'China') return w.slice(0, 2).join(' ').toLowerCase();
  return w[0].toLowerCase();
}
const REG = /\b([A-Z]{1,2}-[A-Z0-9]{3,5}|N\d{1,5}[A-Z]{0,2}|JA\d{3,4}[A-Z]?|B-\d{4,5}|HL\d{4}|VH-[A-Z]{3})\b/;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const FAMILY = [['airbus', /\ba(300|310|318|319|320|321|330|340|350|380)\b/], ['boeing', /\b(7[2-8]7|747|737|777|787)\b/]];
/**
 * Cross-check a Commons category label against the file's own title/description.
 * 'ok' or a reason string. The file must name its airline or carry a registration; a title that names a
 * *different* airline, or a different manufacturer's type, is a mislabelled category.
 */
export function plausible({ title, desc = '', op, type, allOps = [] }) {
  const text = ` ${norm(title + ' ' + desc)} `;
  const brand = opBrand(op);
  const mentionsOp = text.includes(` ${brand.split(' ')[0]} `) || text.includes(` ${norm(op)} `);
  for (const o of allOps) {
    if (opBrand(o) === brand) continue;
    const ob = opBrand(o);
    if (ob.length >= 5 && !ob.startsWith('air ') && text.includes(` ${ob} `) && !mentionsOp) return 'other airline named in title';
  }
  const t = title + ' ' + desc;
  const mk = type.split(' ')[0].toLowerCase();
  for (const [maker, re] of FAMILY) if (re.test(t) && maker !== mk && (mk === 'airbus' || mk === 'boeing')) return 'other manufacturer in title';
  if (!mentionsOp && !REG.test(title)) return 'title names neither airline nor registration';
  return 'ok';
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/** Commons "date taken" strings come in many shapes; return 'YYYY-MM-DD' (day may default to 15) or null when the month is unknown. */
export function parseDate(s) {
  s = String(s ?? '').replace(/<[^>]*>.*$/s, '').trim();
  let m = s.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2]}-${m[3] && +m[3] >= 1 ? m[3] : '15'}`;
  const low = s.toLowerCase();
  const mi = MONTHS.findIndex((mn) => new RegExp(`\\b${mn}\\b`).test(low));
  const y = low.match(/\b(19[7-9]\d|20[0-2]\d)\b/);
  if (mi < 0 || !y) return null;
  const d = low.match(/\b(\d{1,2})\b(?!\s*:)/);
  const day = d && +d[1] >= 1 && +d[1] <= 31 && d[1] !== y[1] ? +d[1] : 15;
  return `${y[1]}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
