import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accuracy, hint, score, square, oklab, oklabToRgb, hexOf, lch, hsvToHex, hexToHsv, rgb } from '../web/color.js';

test('OKLab: white is L=1 with no color, and the round trip back to sRGB is exact', () => {
  const [L, a, b] = oklab('#FFFFFF');
  assert.ok(Math.abs(L - 1) < 1e-6 && Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6);
  for (const hex of ['#FF724C', '#000000', '#123456', '#D2BD0A', '#00FF00', '#7F7F7F']) assert.equal(hexOf(oklabToRgb(...oklab(hex))), hex);
});
test('OKLCH hues land where the named colors are', () => {
  assert.ok(Math.abs(lch('#FF0000')[2] - 29) < 2);
  assert.ok(Math.abs(lch('#FFFF00')[2] - 110) < 2);
  assert.ok(Math.abs(lch('#0000FF')[2] - 264) < 2);
});
test('accuracy is 100 for a match and falls with distance', () => {
  assert.equal(accuracy('#FF724C', '#FF724C'), 100);
  const a = accuracy('#FF7A50', '#FF724C'), b = accuracy('#E06040', '#FF724C'), c = accuracy('#2040A0', '#FF724C');
  assert.ok(a > b && b > c, `${a} ${b} ${c}`);
  assert.ok(c < 5);
});
test('hint points from the guess toward the target on each OKLab axis', () => {
  const [L, , b] = hint('#404040', '#F0E000');
  assert.equal(L.word, 'lighter');
  assert.equal(b.word, 'yellower');
  assert.ok(L.strength >= 2 && b.strength === 3);
  const [, a2] = hint('#FF0000', '#00A000');
  assert.equal(a2.word, 'greener');
  assert.ok(hint('#123456', '#123456').every(h => h.strength === 0 && h.word === 'right on'));
});
test('score: best test minus 3 per extra test, never below 0', () => {
  assert.equal(score([]), 0);
  assert.equal(score([{ acc: 80 }]), 80);
  assert.equal(score([{ acc: 80 }, { acc: 92 }, { acc: 90 }]), 86);
  assert.equal(score(Array(6).fill({ acc: 5 })), 0);
});
test('share squares', () => assert.deepEqual([99, 90, 75, 10].map(square), ['🟩', '🟨', '🟧', '🟥']));
test('the picker\'s HSV maps onto sRGB and back', () => {
  assert.equal(hsvToHex(0, 1, 1), '#FF0000');
  assert.equal(hsvToHex(120, 1, 1), '#00FF00');
  assert.equal(hsvToHex(240, 1, 0.5), '#000080');
  assert.equal(hsvToHex(77, 0, 1), '#FFFFFF');
  assert.equal(hsvToHex(300, 1, 0), '#000000');
  for (const hex of ['#FF724C', '#D2BD0A', '#40C0A0', '#808080', '#123456']) {
    const { h, s, v } = hexToHsv(hex);
    assert.equal(hsvToHex(h, s, v), hex);
  }
  assert.deepEqual(rgb('#FF724C'), [255, 114, 76]);
});
