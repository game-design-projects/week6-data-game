import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { cosine, pearson, semState, trendText } from './lib.js';
import game from './game.js';
test('cosine/pearson', () => {
  assert.ok(Math.abs(cosine([1, 0], [1, 0]) - 1) < 1e-9);
  assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-9);
  assert.ok(Math.abs(pearson([1, 2, 3], [2, 4, 6]) - 1) < 1e-9);
  assert.ok(Math.abs(pearson([1, 2, 3], [3, 2, 1]) + 1) < 1e-9);
});
test('states and text', () => {
  assert.equal(semState(1), 'hit'); assert.equal(semState(0.7), 'near'); assert.equal(semState(0.2), undefined);
  assert.match(trendText({ peak: 1950, last: 0.05 }), /1950/);
});
test('data sanity', () => {
  const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
  assert.ok(d.answers.length >= 60);
  for (const i of d.answers) assert.equal(d.items[i].f.length, 55);
  assert.ok(game.meta.num === 43);
});
