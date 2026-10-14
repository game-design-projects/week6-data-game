import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mulberry, surrogate, METHODS, norm100, diff, mean, std } from './build/synth.mjs';
import game, { layout } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('surrogates keep length and start, are deterministic', () => {
  const x = Array.from({ length: 72 }, (_, i) => Math.sin(i / 5) + i * 0.02);
  for (const m of Object.keys(METHODS)) {
    const a = surrogate(m, x, mulberry(1)), b = surrogate(m, x, mulberry(1));
    assert.equal(a.length, 72); assert.equal(a[0], x[0]); assert.deepEqual(a, b);
  }
});
test('shuffle surrogate preserves step distribution', () => {
  const x = Array.from({ length: 72 }, (_, i) => Math.sin(i / 3) * i);
  const y = surrogate('shuffle', x, mulberry(2));
  assert.ok(Math.abs(mean(diff(x)) - mean(diff(y))) < 1e-9);
  assert.ok(Math.abs(std(diff(x)) - std(diff(y))) < 1e-9);
});
test('norm100 spans 0..100', () => { const n = norm100([3, 5, 9]); assert.equal(n[0], 0); assert.equal(n[2], 100); });
test('data pool shape', () => {
  assert.ok(data.puzzles.length >= 60);
  for (const p of data.puzzles) { assert.equal(p.real.length, 72); assert.equal(p.decoys.length, 3); }
});
test('layout puts real at correct index', () => {
  const rng = { shuffle: (a) => a.slice().reverse() };
  const l = layout(data.puzzles[0], rng);
  assert.equal(l.order[l.correct].real, true);
});
test('puzzle yields 3 ids, deterministic', () => {
  const a = game.puzzle({ data, day: 14 }), b = game.puzzle({ data, day: 14 });
  assert.deepEqual(a, b); assert.equal(new Set(a.ids).size, 3);
  assert.notDeepEqual(a, game.puzzle({ data, day: 15 }));
});
