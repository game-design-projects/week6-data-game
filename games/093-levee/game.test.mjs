import test from 'node:test';
import assert from 'node:assert/strict';
import { N, leveeCells, simulate, dryCount, scoreOf, greedy } from './sim.js';

test('levee cells are clamped inside the grid', () => {
  assert.equal(leveeCells({ r: 3, c: 0, o: 'h' }).length, 5);
  assert.ok(leveeCells({ r: 3, c: 0, o: 'h' }).every((i) => i >= 3 * N && i < 4 * N));
  assert.ok(leveeCells({ r: 15, c: 4, o: 'v' }).every((i) => i % N === 4));
});

test('water conservation: flat terrain, small rain stays below wet threshold', () => {
  const z = new Array(N * N).fill(0);
  const d = simulate(z, 0.1);
  assert.ok(Math.max(...d) <= 0.11);
});

test('a bowl floods its centre and a levee changes the outcome', () => {
  const z = Array.from({ length: N * N }, (_, i) => { const r = Math.floor(i / N), c = i % N; return Math.hypot(r - 7.5, c - 7.5) * 0.8; });
  const b = new Array(N * N).fill(0); b[7 * N + 7] = 10; b[0] = 5;
  const d = simulate(z, 1.5);
  assert.ok(d[7 * N + 7] > 0.3);
  const g = greedy(z, b, 1.5, 1);
  assert.ok(g.dry >= dryCount(b, d));
});

test('simulation is deterministic', () => {
  const z = Array.from({ length: N * N }, (_, i) => (i * 7) % 5);
  assert.deepEqual([...simulate(z, 1)], [...simulate(z, 1)]);
});

test('scoreOf clamps and scales', () => {
  assert.equal(scoreOf(10, 30, 20), 50);
  assert.equal(scoreOf(10, 30, 40), 100);
  assert.equal(scoreOf(10, 30, 5), 0);
});
