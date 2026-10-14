import test from 'node:test'; import assert from 'node:assert/strict';
import game, { describeSpike } from './game.js';
import data from './data.json' with { type: 'json' };
test('describeSpike', () => {
  const s = describeSpike([...Array(20).fill(100), 1000]);
  assert.equal(s.base, 100); assert.equal(s.factor, 10); assert.equal(s.calm, 20);
});
test('data sanity', () => {
  assert.ok(data.puzzles.length >= 60);
  for (const p of data.puzzles) { assert.equal(p.series.length, 21); assert.ok(data.options.includes(p.title)); assert.ok(p.co.length >= 3); }
});
test('puzzle ids resolve', () => {
  const pick = (a) => a[0];
  assert.ok(data.puzzles.some((p) => p.id === game.puzzle({ data, pick }).id));
});
