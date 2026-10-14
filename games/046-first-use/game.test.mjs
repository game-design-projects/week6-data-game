import test from 'node:test';
import assert from 'node:assert/strict';
import { yearScore } from './game.js';
test('yearScore', () => {
  assert.equal(yearScore(1600, 1603), 1);
  assert.ok(yearScore(1700, 1600) < yearScore(1650, 1600));
  assert.ok(yearScore(1200, 1900) < 0.01);
});
