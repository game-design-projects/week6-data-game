import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { summarize } from './game.js';

test('summarize', () => {
  assert.deepEqual(summarize([10, 50, 20]), { max: 50, min: 10, relief: 40, peakAt: 0.5 });
});
test('data pool', () => {
  const d = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
  assert.ok(d.puzzles.length >= 60);
  for (const p of d.puzzles) { assert.equal(p.elev.length, 81); assert.ok(d.regions[p.region]); assert.ok(p.elev.every(Number.isFinite)); }
  assert.ok(game.meta.sources.length);
});
