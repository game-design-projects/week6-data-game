import test from 'node:test';
import assert from 'node:assert';
import game, { makePairs } from './game.js';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('data is real-looking and positive', () => {
  assert.ok(data.items.length > 100);
  assert.ok(data.items.every((x) => x.n > 0 && x.p));
});

test('pairs are disjoint with distinct counts', () => {
  const rng = { shuffle: (a) => a.slice().reverse(), chance: () => true };
  const pairs = makePairs(data.items, rng);
  assert.equal(pairs.length, 8);
  const seen = new Set(pairs.flat().map((x) => x.p));
  assert.equal(seen.size, 16);
  assert.ok(pairs.every(([a, b]) => a.n !== b.n));
});
