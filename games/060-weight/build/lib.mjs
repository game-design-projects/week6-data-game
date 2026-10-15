export function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...b] = rows;
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
export const list = (s) => [...(s || '').matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1] ?? m[2]).filter(Boolean);
const NAMED = { quot: '"', amp: '&', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', bull: '•', eacute: 'é', aacute: 'á', oacute: 'ó', iacute: 'í', uacute: 'ú', egrave: 'è', agrave: 'à', ouml: 'ö', auml: 'ä', uuml: 'ü', ccedil: 'ç', ntilde: 'ñ', nbsp: ' ', times: '×', deg: '°', apos: "'" };
/** Decode BGG's HTML: numeric entities 128-255 are UTF-8 bytes written as latin-1 code points (mojibake), so re-decode those runs. */
export function ent(s) {
  let t = s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  t = t.replace(/[\u0080-\u00ff]+/g, (run) => { const d = Buffer.from(run, 'latin1').toString('utf8'); return d.includes('\ufffd') ? ' ' : d; });
  t = t.replace(/&([a-z]+);/gi, (m, n) => NAMED[n] ?? NAMED[n.toLowerCase()] ?? ' ');
  return t.replace(/<[^>]+>/g, '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
}

