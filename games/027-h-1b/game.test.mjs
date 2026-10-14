import test from 'node:test';
import assert from 'node:assert/strict';
import game, { where } from './game.js';
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
test('where buckets', () => {
  const c = { p25: 100, p75: 200 };
  assert.match(where(50, c), /低于/); assert.match(where(150, c), /中间/); assert.match(where(300, c), /高于/);
});
test('data pool sane', () => {
  assert.ok(data.puzzles.length >= 60);
  for (const x of data.puzzles) { assert.ok(x.sal >= 25000 && x.sal <= 700000); assert.ok(data.cells[x.q][x.city]); }
});
