// Shared by build/build.mjs (snapshot) and game.js load() (live crt.sh): turn crt.sh rows into a clue list.
export const MAX_LABELS = 36;
export const MIN_LABELS = 24;
const SHARED_CAP = 18;

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Strings whose appearance inside a label would give the company away. */
export function brandTokens(c) {
  const toks = new Set();
  const id = c.id || String(c.domain).split('.')[0];
  if (id.length >= 3) toks.add(id);
  const nm = norm(c.name);
  if (nm.length >= 3) toks.add(nm);
  for (const w of String(c.name).toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 4) toks.add(w);
  const out = new Set(toks);
  for (const t of toks) for (let i = 4; i < t.length; i++) out.add(t.slice(0, i)); // prefixes: "forti", "khanx"…
  return [...out];
}

export function labelOk(l, c) {
  if (!/^[a-z][a-z0-9-]{1,22}[a-z0-9]$/.test(l)) return false;
  if (/\d{4,}/.test(l) || (l.match(/\d/g) || []).length > 2) return false;
  if (/[a-f0-9]{8,}/.test(l.replace(/-/g, ''))) return false;
  const flat = norm(l);
  return !brandTokens(c).some((t) => flat.includes(t));
}

/**
 * crt.sh rows → Map(label → latest not_before date) for the label directly under `c.domain`.
 * `date` (YYYY-MM-DD, optional): only certificates issued before that day and still valid on it.
 */
export function extractLabels(rows, c, date) {
  const lab = new Map();
  const dom = c.domain;
  for (const e of rows || []) {
    const d = String(e.not_before || '').slice(0, 10);
    if (date && (d >= date || String(e.not_after || '').slice(0, 10) < date)) continue;
    for (const n of String(e.name_value || '').split('\n')) {
      const h = n.trim().toLowerCase().replace(/^\*\./, '');
      if (!h.endsWith('.' + dom)) continue;
      const pre = h.slice(0, -dom.length - 1);
      if (!pre || pre.includes('*')) continue;
      const first = pre.split('.').pop();
      if (!labelOk(first, c)) continue;
      if (!lab.has(first) || lab.get(first) < d) lab.set(first, d);
    }
  }
  return lab;
}

/** Order: most-shared labels first (generic), then labels only this company has (newest first). */
export function pickLabels(lab, freq) {
  const all = [...lab.entries()].map(([l, d]) => ({ l, d, f: freq[l] || 1 }));
  const unique = all.filter((x) => x.f === 1).sort((a, b) => b.d.localeCompare(a.d) || a.l.localeCompare(b.l));
  const shared = all.filter((x) => x.f > 1).sort((a, b) => b.f - a.f || b.d.localeCompare(a.d) || a.l.localeCompare(b.l));
  const picked = [...shared.slice(0, SHARED_CAP), ...unique.slice(0, MAX_LABELS - Math.min(SHARED_CAP, shared.length))].slice(0, MAX_LABELS);
  return {
    total: lab.size,
    latest: picked.map((x) => x.d).sort().pop() || '',
    labels: picked.map((x) => x.l),
  };
}

/** Live shaping used by load(): null if there is too little to play with. */
export function toLive(rows, c, freq, date) {
  const lab = extractLabels(rows, c, date);
  if (lab.size < MIN_LABELS) return null;
  return { id: c.id, ...pickLabels(lab, freq) };
}
