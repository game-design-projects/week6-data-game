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
const words = Object.keys(ng).filter((w) => idx.has(w));
const top = vocab.slice(0, 50000).map((w, i) => [w, vec(i)]);
const items = [];
for (const w of words) {
  const v = vec(idx.get(w));
  const cur = ng[w]; const pts = [];
  for (let y = 0; y < 220; y += 4) { const s = cur.slice(y, y + 4); pts.push(s.reduce((a, b) => a + b, 0) / s.length); }
  const pos = pts.filter((x) => x > 0); if (pos.length < 50) continue;
  const mx = Math.max(...pts), floor = Math.min(...pos);
  const log = pts.map((x) => Math.log10(Math.max(x, floor)));
  const peak = 1800 + pts.indexOf(mx) * 4;
  const nn = top.map(([u, uv]) => [u, dot(v, uv)]).sort((a, b) => b[1] - a[1]).map((x) => x[0])
    .filter((u) => u !== w && /^[a-z]+$/.test(u) && !u.startsWith(w.slice(0, 4)) && !w.startsWith(u.slice(0, 4))).slice(0, 4);
  items.push({ w, f: log.map((x) => +x.toFixed(2)), peak, range: +(Math.log10(mx / floor)).toFixed(2), v: v.map((x) => Math.round(x * 127)), nn,
    last: +(pts.at(-1) / mx).toFixed(3) });
}
const answers = items.map((x, i) => [x, i]).filter(([x]) => x.range >= 1.0 && x.w.length >= 4).map(([, i]) => i);
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ y0: 1800, step: 4, items, answers }));
console.log(items.length, answers.length);
