import { test } from 'node:test';
import assert from 'node:assert/strict';
import game, { edgeF1, pairKey } from './game.js';

test('F1 perfect, empty, direction-reversed, partial', () => {
  const T = ['a>b', 'c>d'];
  assert.equal(edgeF1(T, T), 1);
  assert.equal(edgeF1(T, []), 0);
  assert.equal(edgeF1(T, ['b>a']), 0);
  assert.ok(Math.abs(edgeF1(T, ['a>b']) - 2 / 3) < 1e-9);
  assert.equal(pairKey('x', 'y'), 'x>y');
});

test('puzzle keeps species and edges', () => {
  const data = { puzzles: [{ eco: 'e', sp: ['a', 'b', 'c', 'd', 'e', 'f'], e: [['a', 'b', 2]] }] };
  const rng = { shuffle: (x) => x.slice().reverse() };
  const p = game.puzzle({ data, pick: (a) => a[0], rng });
  assert.equal(p.sp.length, 6);
  assert.deepEqual(p.e, [['a', 'b', 2]]);
});
