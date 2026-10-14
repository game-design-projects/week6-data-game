import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hazard, solve, pathCost, routeScore, line, decodeGrid } from './route.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('hazard is monotone', () => {
  let prev = 0;
  for (let L = 0; L <= 15; L++) { assert.ok(hazard(L) >= prev); prev = hazard(L); }
});

test('solve beats or equals the straight line and path is contiguous', () => {
  for (const p of data.puzzles.slice(0, 10)) {
    const g = decodeGrid(p.grid);
    const r = solve(g, data.w, data.h, p.start, p.end);
    assert.ok(r.cost <= r.straight + 1e-9);
    assert.ok(Math.abs(pathCost(g, data.w, r.path) - r.cost) < 1e-6);
    for (let i = 1; i < r.path.length; i++) assert.ok(Math.abs(r.path[i][0] - r.path[i - 1][0]) <= 1 && Math.abs(r.path[i][1] - r.path[i - 1][1]) <= 1);
  }
});

test('routeScore', () => {
  assert.equal(routeScore(10, 10), 100);
  assert.equal(routeScore(10, 20), 35);
  assert.equal(routeScore(10, 5), 100);
});

test('line endpoints', () => {
  const l = line([0, 0], [10, 3]);
  assert.deepEqual(l[0], [0, 0]); assert.deepEqual(l.at(-1), [10, 3]);
});

test('data pool', () => {
  assert.ok(data.puzzles.length >= 40);
  assert.equal(new Set(data.puzzles.map((p) => p.date)).size, data.puzzles.length);
  for (const p of data.puzzles) assert.equal(p.grid.length, data.w * data.h);
});
