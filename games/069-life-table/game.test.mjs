import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import g, { survival } from './game.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
test('survival', () => assert.equal(survival(90000, 45000), 50));
test('data sane', () => {
  for (const c of data.countries) for (const s of ['F', 'M']) assert.ok(c[s].p > 0 && c[s].p < 100);
  assert.ok(data.countries.length > 100);
});
test('puzzle deterministic', () => {
  const rng = () => ({ chance: () => true });
  const a = g.puzzle({ data, pick: (x) => x[0], rng: rng() });
  assert.deepEqual(a, g.puzzle({ data, pick: (x) => x[0], rng: rng() }));
});
