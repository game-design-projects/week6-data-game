import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { posterior, visibleAnswers } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('visibleAnswers grows then caps at 5', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 8].map(visibleAnswers), [2, 3, 4, 5, 5, 5]);
});
test('posterior sums to 1 and favours the source state', () => {
  const p = data.puzzles[0];
  const post = posterior(data, p.clues);
  assert.ok(Math.abs(Object.values(post).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(post[p.st] > 1 / 48);
});
test('every puzzle references real questions/options and rank <= 6', () => {
  for (const p of data.puzzles) {
    assert.equal(p.clues.length, 5);
    assert.ok(p.rank <= 6);
    for (const [q, k] of p.clues) assert.ok(data.questions[q].opts[k]);
  }
});
test('puzzle() is deterministic', () => {
  const mk = () => game.puzzle({ data, pick: (a) => a[3] });
  assert.deepEqual(mk(), mk());
});
