// raw/ngram.json + GloVe -> ../data.json
import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(import.meta.dirname, 'raw');
const ng = JSON.parse(fs.readFileSync(path.join(raw, 'ngram.json')));
const vocab = JSON.parse(fs.readFileSync(path.join(raw, 'vocab.json')));
const buf = fs.readFileSync(path.join(raw, 'glove-wiki-gigaword-50.model.vectors.npy'));
const hl = buf.readUInt16LE(8); const D = 50; const off = 10 + hl;
const F = new Float32Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + vocab.length * D * 4));
const idx = new Map(vocab.slice(0, 400000).map((w, i) => [w, i]));
const vec = (i) => { const v = Array.from(F.subarray(i * D, i * D + D)); const n = Math.hypot(...v); return v.map((x) => x / n); };
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const DROP = new Set(['negro', 'madam', 'telegram', 'proton', 'pioneer', 'colored']); // sensitive or garbage neighbours
const words = Object.keys(ng).filter((w) => idx.has(w) && !DROP.has(w));
const top = vocab.slice(0, 50000).map((w, i) => [w, vec(i)]);
const items = [];
for (const w of words) {
  const v = vec(idx.get(w));
  const pts = ng[w]; if (pts.length !== 220) continue; // yearly 1800-2019, API smoothing 3
  const pos = pts.filter((x) => x > 0); if (pos.length < 50) continue;
  const mx = Math.max(...pts), floor = Math.min(...pos);
  const log = pts.map((x) => Math.log10(Math.max(x, floor)));
  const peak = 1800 + pts.indexOf(mx);
  const stem = (a, b) => { let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++; return k >= 4 || k >= Math.min(a.length, b.length) - 1; };
  const nn = top.map(([u, uv]) => [u, dot(v, uv)]).sort((a, b) => b[1] - a[1]).map((x) => x[0])
    .filter((u) => /^[a-z]{3,}$/.test(u) && u !== w && !u.includes(w) && !w.includes(u) && !stem(u, w)).slice(0, 12);
  const keep = [];
  for (const u of nn) if (!keep.some((k) => stem(k, u) || k.includes(u) || u.includes(k))) keep.push(u);
  items.push({ w, f: log.map((x) => +x.toFixed(2)), peak, range: +(Math.log10(mx / floor)).toFixed(2), v: v.map((x) => Math.round(x * 127)), nn: keep.slice(0, 4),
    last: +(pts.at(-1) / mx).toFixed(3) });
}
const answers = items.map((x, i) => [x, i]).filter(([x]) => x.range >= 1.3 && x.w.length >= 4).map(([, i]) => i);
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ y0: 1800, step: 1, items, answers }));
console.log(items.length, answers.length);
