import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../web/painting.js';
import { oklab, oklabToRgb } from '../web/color.js';

test('runs decode to row-major pixel indices', () => {
  assert.deepEqual([...P.regionIndices([2, 3, 10, 1])], [2, 3, 4, 10]);
  assert.deepEqual([...P.regionIndices([])], []);
});
test('the outline is the region pixels that touch the outside', () => {
  // 4x4 image, region is the 3x3 block at the top left: only its center (5) is interior
  const idx = P.regionIndices([0, 3, 4, 3, 8, 3]);
  assert.deepEqual([...P.edgeIndices(idx, 4, 4)], [0, 1, 2, 4, 6, 8, 9, 10]);
});
test('repainting with the answer restores the original pixels; another color keeps the shading', () => {
  const answer = '#B0603A';
  const original = ['#C06A40', '#A05834', '#B0603A', '#8F4C2C'];
  // encode as the builder does: NEUTRAL + (pixel - answer) in OKLab
  const A = oklab(answer);
  const base = new Uint8ClampedArray(original.length * 4);
  original.forEach((hex, p) => {
    const lab = oklab(hex);
    base.set([...oklabToRgb(...lab.map((v, c) => P.NEUTRAL[c] + v - A[c])), 255], p * 4);
  });
  const idx = P.regionIndices([0, original.length]);
  const off = P.offsets(base, idx);
  const out = new Uint8ClampedArray(base);
  P.repaint(out, base, idx, off, answer);
  original.forEach((hex, p) => {
    const want = oklabToRgb(...oklab(hex));
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(out[p * 4 + c] - want[c]) <= 2, `pixel ${p} channel ${c}: ${out[p * 4 + c]} vs ${want[c]}`);
  });
  P.repaint(out, base, idx, off, '#3A6AB0');
  const L = p => oklab('#' + [0, 1, 2].map(c => out[p * 4 + c].toString(16).padStart(2, '0')).join(''))[0];
  assert.ok(L(0) > L(3), 'the lighter pixel stays lighter in a new color');
  P.repaint(out, base, idx, off, null);
  assert.deepEqual(out, base);
});
