import test from 'node:test';
import assert from 'node:assert/strict';
import { spread, tier } from './game.js';
const rng = { shuffle: (a) => a };
test('spread keeps counts apart', () => {
  const items = [10, 11, 12, 30, 31, 60, 100, 101, 200].map((n, i) => ({ id: i, n }));
  const s = spread(items, 5, rng);
  assert.equal(s.length, 5);
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) assert.ok(Math.abs(s[i].n - s[j].n) >= 3);
});
test('tier buckets', () => {
  assert.match(tier(250), /全球/);
  assert.match(tier(5), /本地/);
});
