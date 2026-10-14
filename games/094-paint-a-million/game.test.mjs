import test from 'node:test';
import assert from 'node:assert/strict';
import { optimalCells, scoreRun } from './game.js';

test('optimalCells takes densest first and stops at 95% of target', () => {
  const cells = [500000, 300000, 200000, 100000, 10, 0];
  const o = optimalCells(cells);
  assert.equal(o.k, 3); // 500k+300k+200k = 1M >= 950k
  assert.deepEqual(o.idx, [0, 1, 2]);
  assert.equal(optimalCells([600000, 400000, 1]).k, 2);
  assert.equal(optimalCells([960000, 5]).k, 1);
});

test('scoreRun: efficiency x accuracy', () => {
  assert.equal(scoreRun(1_000_000, 10, 10), 100);
  assert.equal(scoreRun(1_040_000, 20, 10), 50);
  assert.equal(scoreRun(1_175_000, 10, 10), 50); // 17.5% off => acc .5
  assert.equal(scoreRun(1_400_000, 10, 10), 0);
  assert.equal(scoreRun(0, 0, 10), 0);
  assert.equal(scoreRun(1_000_000, 5, 10), 100); // capped
});
