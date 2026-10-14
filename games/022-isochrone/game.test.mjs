import test from 'node:test';
import assert from 'node:assert/strict';
import game, { bands, farthest } from './game.js';
import data from './data.json' with { type: 'json' };

test('bands split at 15 minutes', () => {
  const b = bands([[0, 0, 5, 'a'], [0, 0, 15, 'b'], [0, 0, 20, 'c']]);
  assert.equal(b.near.length, 2);
  assert.equal(b.far.length, 1);
});
test('farthest picks max distance', () => {
  const d = (a, b) => Math.hypot(b.lat - a.lat, b.lng - a.lng);
  const f = farthest({ lat: 0, lng: 0 }, [[1, 1, 1, 'x'], [3, 4, 1, 'y']], d);
  assert.equal(f.s[3], 'y');
  assert.equal(f.d, 5);
});
test('data sane and reach within 30 min', () => {
  assert.ok(data.puzzles.length >= 60);
  for (const p of data.puzzles) for (const s of p.reached) assert.ok(s[2] <= 30);
});
test('puzzle deterministic', () => {
  const pick = (a) => a[0];
  assert.deepEqual(game.puzzle({ data, pick }), game.puzzle({ data, pick }));
});
