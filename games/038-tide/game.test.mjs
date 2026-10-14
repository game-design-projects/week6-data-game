import test from 'node:test';
import assert from 'node:assert/strict';
import { peaks, analyse } from './game.js';
const sine = (periodH, n = 72, amp = 1) => Array.from({ length: n }, (_, h) => amp * Math.sin((2 * Math.PI * h) / periodH) + amp);
test('peaks semidiurnal', () => assert.equal(peaks(sine(12.42)).length, 6));
test('analyse diurnal', () => { const a = analyse(sine(24.84)); assert.match(a.type, /全日/); assert.ok(Math.abs(a.range - 2) < 0.05); });
test('analyse semidiurnal', () => assert.match(analyse(sine(12.42)).type, /半日/));
test('plateau counted once', () => assert.deepEqual(peaks([0, 1, 1, 0]), [1]));
test('mixed tide', () => {
  const v = Array.from({ length: 72 }, (_, h) => Math.sin((2 * Math.PI * h) / 12.42) + 0.9 * Math.sin((2 * Math.PI * h) / 24.84 + 1) + 2);
  assert.equal(analyse(v).kind, 'mixed');
});
