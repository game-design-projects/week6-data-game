import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { pickRivals } from './game.js';
const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const rng = { sample: (a, n) => a.slice(0, n) };
test('rivals differ enough', () => {
  const t = data.counties[5];
  const r = pickRivals(data.counties, t, rng);
  assert.equal(r.length, 3);
  for (const x of r) assert.ok(Math.abs(x.fmr[2] - t.fmr[2]) / t.fmr[2] >= 0.12);
});
test('data sane', () => {
  assert.ok(data.counties.length > 1000);
  for (const c of data.counties) assert.ok(c.fmr.every((v, i, a) => i === 0 || v >= a[i - 1] * 0.9));
});
test('meta', () => assert.equal(game.meta.num, 31));
