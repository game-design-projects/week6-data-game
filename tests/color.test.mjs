import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAINTS, mixHex, accuracy, hint, score, square, oklab } from '../web/color.js';
import { OKLab_to_OKLCh } from '../web/vendor/spectral.js';

const idx = Object.fromEntries(PAINTS.map((p, i) => [p.id, i]));
const pot = recipe => PAINTS.map(p => recipe[p.id] || 0);
const hue = hex => OKLab_to_OKLCh(oklab(hex))[2];
const lightness = hex => oklab(hex)[0];

test('empty pot has no color', () => assert.equal(mixHex(pot({})), null));
test('a single paint mixes to itself', () => {
  for (const p of PAINTS) assert.ok(accuracy(mixHex(pot({ [p.id]: 3 })), p.hex) > 99, p.name);
});
test('mixing is subtractive: cyan + yellow is green, magenta + yellow is red-orange', () => {
  const green = hue(mixHex(pot({ C: 1, Y: 1 })));
  assert.ok(green > 120 && green < 160, `cyan+yellow hue ${green}`);
  const red = hue(mixHex(pot({ M: 1, Y: 1 })));
  assert.ok(red > 15 && red < 50, `magenta+yellow hue ${red}`);
});
test('black is strong: one black in one white is a mid gray', () => {
  const L = lightness(mixHex(pot({ W: 1, K: 1 })));
  assert.ok(L > 0.35 && L < 0.6, `L=${L}`);
});
test('each extra white drop lightens, with diminishing steps', () => {
  const Ls = [1, 2, 4, 8].map(w => lightness(mixHex(pot({ M: 1, W: w }))));
  for (let i = 1; i < Ls.length; i++) assert.ok(Ls[i] > Ls[i - 1]);
});
test('only the ratio matters', () => assert.equal(mixHex(pot({ C: 2, Y: 4 })), mixHex(pot({ C: 1, Y: 2 }))));
test('accuracy is 100 for a match and falls with distance', () => {
  assert.equal(accuracy('#FF724C', '#FF724C'), 100);
  const a = accuracy('#FF7A50', '#FF724C'), b = accuracy('#E06040', '#FF724C'), c = accuracy('#2040A0', '#FF724C');
  assert.ok(a > b && b > c, `${a} ${b} ${c}`);
  assert.ok(c < 5);
});
test('hint points from the guess toward the target on each OKLab axis', () => {
  const [L, a, b] = hint('#404040', '#F0E000');
  assert.equal(L.word, 'lighter');
  assert.equal(b.word, 'yellower');
  assert.ok(L.strength >= 2 && b.strength === 3);
  const [L2, a2] = hint('#FF0000', '#00A000');
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
