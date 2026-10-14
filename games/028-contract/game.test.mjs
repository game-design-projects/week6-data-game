import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { pickSet, factorOff } from './game.js';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('factorOff is symmetric and >= 1', () => {
  assert.equal(factorOff(200, 100), factorOff(50, 100));
  assert.equal(factorOff(100, 100), 1);
});
test('pickSet draws 3 distinct magnitude buckets', () => {
  const ids = pickSet(data.awards, makeRng(7), 3);
  assert.equal(new Set(ids.map((i) => data.awards[i].b)).size, 3);
});
test('puzzle deterministic', () => {
  const a = game.puzzle({ data, rng: makeRng(3) }); const b = game.puzzle({ data, rng: makeRng(3) });
  assert.deepEqual(a, b);
});
