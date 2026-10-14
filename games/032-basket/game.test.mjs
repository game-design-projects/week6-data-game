import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { solveExact, scoreGap } from './solve.mjs';

test('scoreGap', () => {
  assert.equal(scoreGap(0), 100);
  assert.equal(scoreGap(5), 70);
  assert.equal(scoreGap(40), 0);
});
test('solveExact small case', () => {
  const r = solveExact([100, 250, 300, 50], 600, 5, 2);
  assert.ok(r.count > 0);
  assert.equal(r.example.reduce((s, q, i) => s + q * [100, 250, 300, 50][i], 0), 600);
  assert.equal(solveExact([300, 500], 400, 5, 1).count, 0);
});
test('every shipped puzzle has a valid exact solution', () => {
  const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
  assert.ok(d.puzzles.length >= 60);
  for (const p of d.puzzles) {
    const cents = p.items.map((id) => d.items[id].p[p.year]);
    assert.ok(cents.every(Boolean));
    assert.equal(p.sol.reduce((s, q, i) => s + q * cents[i], 0), d.budget);
    assert.ok(p.sol.filter(Boolean).length >= d.minKinds);
    assert.ok(Math.max(...p.sol) <= d.maxQty);
  }
});
