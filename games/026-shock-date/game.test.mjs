import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { rebase, dayScore } from './game.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));

test('dayScore', () => {
  assert.equal(dayScore(10, 10), 100);
  assert.ok(dayScore(13, 10) > 30 && dayScore(13, 10) < 40);
  assert.ok(dayScore(1, 50) < 1);
});
test('rebase', () => {
  assert.deepEqual(rebase({ kind: 'pct', base: 50, v: [50, 100] }), [100, 200]);
  assert.deepEqual(rebase({ kind: 'diff', base: 2, v: [2, 2.5] }), [0, 0.5]);
});
test('data integrity', () => {
  assert.ok(data.puzzles.length >= 60);
  for (const p of data.puzzles) {
    assert.equal(p.series.length, 4);
    for (const s of p.series) assert.equal(s.v.length, p.n);
    assert.ok(p.ans >= 1 && p.ans <= p.n);
    assert.ok(data.events[p.ev]);
  }
});
test('puzzle deterministic', () => {
  const pick = (a) => a[0];
  assert.deepEqual(game.puzzle({ data, pick }), game.puzzle({ data, pick }));
});
