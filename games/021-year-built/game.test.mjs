import test from 'node:test';
import assert from 'node:assert/strict';
import { yearScore } from './game.js';
test('yearScore', () => {
  assert.equal(yearScore(1900, 1900), 1);
  assert.ok(Math.abs(yearScore(1930, 1900) - Math.exp(-1)) < 1e-9);
  assert.ok(yearScore(1800, 1900) < yearScore(1890, 1900));
});
