import test from 'node:test';
import assert from 'node:assert/strict';
import game, { decode, stats, temp } from './game.js';

test('decode delta ways', () => {
  assert.deepEqual(decode([[0, 10, 20, 5, -5, 5, 5]])[0].pts, [[10, 20], [15, 15], [20, 20]]);
});
test('perfect grid has gridness ~1, diagonal mix lower', () => {
  const grid = [[0, 0, 0, 100, 0], [0, 0, 0, 0, 100], [1, 50, 50, 100, 0]];
  assert.ok(stats(grid).grid > 0.99);
  const mixed = [[0, 0, 0, 100, 0], [0, 0, 0, 70, 70], [0, 0, 0, 20, 100], [0, 0, 0, 100, 40]];
  assert.ok(stats(mixed).grid < 0.9);
});
test('temp bands', () => { assert.match(temp(10), /滚烫/); assert.match(temp(20000), /冰冷/); });
test('puzzle is deterministic', () => {
  const data = { cities: [{ name: 'a' }, { name: 'b' }] };
  const pick = (a) => a[0];
  assert.deepEqual(game.puzzle({ data, pick }), game.puzzle({ data, pick }));
});
