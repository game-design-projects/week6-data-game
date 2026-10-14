import test from 'node:test';
import assert from 'node:assert/strict';
import game, { weekDate, weekDist, weekScore } from './game.js';

test('weekDate maps weeks to calendar dates', () => {
  assert.deepEqual(weekDate(1), { m: 1, d: 1 });
  assert.deepEqual(weekDate(5), { m: 1, d: 29 });
  assert.equal(weekDate(52).m, 12);
});
test('weekDist wraps around the year', () => {
  assert.equal(weekDist(1, 52), 1);
  assert.equal(weekDist(10, 36), 26);
  assert.equal(weekDist(20, 20), 0);
});
test('weekScore: exact is 1, decays, symmetric across year end', () => {
  assert.equal(weekScore(30, 30), 1);
  assert.ok(weekScore(36, 30) < 0.4 && weekScore(36, 30) > 0.3);
  assert.equal(weekScore(2, 51), weekScore(51, 2));
});
test('puzzle is deterministic and keeps the answer among options', async () => {
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
  const mk = (seed) => { let s = seed; const rng = { shuffle: (a) => a.slice().reverse() }; return { data, rng, pick: (a) => a[s % a.length] }; };
  const a = game.puzzle(mk(3)), b = game.puzzle(mk(3));
  assert.deepEqual(a, b);
  assert.ok(a.o.includes(a.s));
  assert.equal(new Set(a.o).size, 5);
});
