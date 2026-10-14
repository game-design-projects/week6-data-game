import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildQuestions, scoreFor } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
test('score', () => {
  assert.equal(scoreFor(5, 1, true), 85);
  assert.equal(scoreFor(5, 2, true), 73);
  assert.equal(scoreFor(20, 3, true), 16);
  assert.equal(scoreFor(5, 3, false), 0);
});
test('questions split the pool and are deterministic', () => {
  const qs = buildQuestions(data.countries);
  assert.ok(qs.length > 30);
  for (const q of qs) {
    const yes = data.countries.filter(q.test).length;
    assert.ok(yes > 0 && yes < data.countries.length, q.id);
  }
  assert.deepEqual(qs.map((q) => q.text), buildQuestions(data.countries).map((q) => q.text));
});
test('questions can tell countries apart', () => {
  const qs = buildQuestions(data.countries);
  const sig = new Set(data.countries.map((c) => qs.map((q) => +q.test(c)).join('')));
  assert.ok(sig.size >= data.countries.length - 2);
});
