import test from 'node:test'; import assert from 'node:assert/strict';
import { yearScore, findHints } from './game.js';
test('yearScore', () => {
  assert.equal(yearScore(1900, 1900), 100);
  assert.ok(Math.abs(yearScore(1908, 1900) - 36.8) < 0.1);
  assert.ok(yearScore(1890, 1900) < yearScore(1895, 1900));
});
test('findHints', () => {
  assert.deepEqual(findHints('The Telegraph and the Railroad').map((h) => h.w), ['telegraph', 'railroad']);
  assert.equal(findHints('nothing here').length, 0);
});
