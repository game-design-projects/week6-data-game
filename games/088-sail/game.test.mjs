import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { boatSpeed, model, optimalRoute, routeHours, scoreFor } from './game.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const mkPuzzle = (i) => game.puzzle({ data, pick: (a) => a[i % a.length] });

test('upwind is slower than a reach, and tacking is continuous at 45deg', () => {
  assert.ok(boatSpeed(15, 90) > boatSpeed(15, 10));
  assert.ok(Math.abs(boatSpeed(15, 44.999) - boatSpeed(15, 45)) < 0.01);
  assert.ok(boatSpeed(0, 90) > 0);
});
test('scoring', () => {
  assert.equal(scoreFor(10, 10), 100);
  assert.equal(scoreFor(10, 20), 13);
  assert.equal(scoreFor(10, null), 0);
  assert.equal(scoreFor(10, 8), 100);
});
test('optimal route is at least as fast as direct and reaches B', () => {
  for (let i = 0; i < data.puzzles.length; i += 7) {
    const p = mkPuzzle(i), m = model(p), o = optimalRoute(m);
    assert.ok(Number.isFinite(o.hours), `reachable ${p.strait.id} ${p.when}`);
    assert.deepEqual(o.path[0], m.A);
    assert.deepEqual(o.path.at(-1), m.B);
    const d = routeHours(m, [m.A, m.B]);
    if (d != null) assert.ok(o.hours <= d + 1e-6);
  }
});
