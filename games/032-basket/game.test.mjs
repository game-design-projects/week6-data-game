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

import game from './game.js';
test('puzzle() valid for days 1-120', () => {
  const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data: d, day, pick: (a) => a[(day - 1) % a.length] });
    assert.equal(p.items.length, 8);
    assert.equal(new Set(p.items).size, 8);
    assert.ok(Number.isInteger(p.year) && p.year >= 1980 && p.year <= 2026);
    assert.ok(p.n >= 40);
    const cents = p.items.map((id) => d.items[id].p[p.year]);
    for (const c of cents) assert.ok(Number.isInteger(c) && c >= 5 && c <= 2000, `${p.year} price ${c}`);
    for (const id of p.items) { const it = d.items[id]; assert.ok(it.name && it.unit && it.emoji); }
    assert.equal(p.sol.reduce((s, q, i) => s + q * cents[i], 0), 2000);
  }
});
test('scoring extremes', () => {
  assert.equal(scoreGap(0), 100);
  assert.ok(scoreGap(1) > scoreGap(10));
  assert.equal(scoreGap(2000), 0);
});
test('no answer text in titles', () => {
  assert.ok(!/\d{4}/.test(game.meta.title + game.meta.tagline));
});
