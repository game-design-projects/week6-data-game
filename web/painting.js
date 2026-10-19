// The painting's hidden region: decode it and repaint it in the picked color, keeping the
// painting's own shading. No DOM in here; game.js owns the canvas.
//
// scripts/build_paintings.py stores every region pixel as NEUTRAL + (pixel - answer) in OKLab,
// so repainting with color P gives P + (pixel - answer): exactly the original when P is the answer.
import { linearToOklab, oklabToRgb, oklab } from './color.js';

export const NEUTRAL = [0.62, 0, 0]; // must match NEUTRAL in scripts/build_paintings.py

const LINEAR = Float32Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

/** Pixel indices (row-major) of the region, from the builder's [start, length, ...] runs. */
export function regionIndices(runs) {
  let n = 0;
  for (let i = 1; i < runs.length; i += 2) n += runs[i];
  const idx = new Uint32Array(n);
  let k = 0;
  for (let i = 0; i < runs.length; i += 2) for (let p = runs[i], end = p + runs[i + 1]; p < end; p++) idx[k++] = p;
  return idx;
}

/** Each region pixel's OKLab offset from NEUTRAL, read from the RGBA pixels of the encoded image. */
export function offsets(rgba, idx) {
  const out = new Float32Array(idx.length * 3);
  idx.forEach((p, k) => {
    const lab = linearToOklab(LINEAR[rgba[p * 4]], LINEAR[rgba[p * 4 + 1]], LINEAR[rgba[p * 4 + 2]]);
    for (let c = 0; c < 3; c++) out[k * 3 + c] = lab[c] - NEUTRAL[c];
  });
  return out;
}

/** Region pixels that touch a pixel outside it: the outline drawn while nothing is picked. */
export function edgeIndices(idx, w, h) {
  const inside = new Uint8Array(w * h);
  for (const p of idx) inside[p] = 1;
  return idx.filter(p => {
    const x = p % w, y = (p - x) / w;
    return x === 0 || y === 0 || x === w - 1 || y === h - 1 || !inside[p - 1] || !inside[p + 1] || !inside[p - w] || !inside[p + w];
  });
}

/** Write the region into `rgba` painted in `hex` (or as the bare stored shading when hex is null). */
export function repaint(rgba, base, idx, off, hex) {
  if (!hex) {
    for (const p of idx) for (let c = 0; c < 3; c++) rgba[p * 4 + c] = base[p * 4 + c];
    return;
  }
  const [L, a, b] = oklab(hex);
  idx.forEach((p, k) => {
    const px = oklabToRgb(L + off[k * 3], a + off[k * 3 + 1], b + off[k * 3 + 2]);
    rgba[p * 4] = px[0]; rgba[p * 4 + 1] = px[1]; rgba[p * 4 + 2] = px[2];
  });
}
