import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLangs, TIERS } from './game.js';
const rng = { sample: (a, n) => a.slice(0, n) };
test('pickLangs gives 6 langs ordered far to near', () => {
  const c = { l: Object.fromEntries(TIERS.flat().map((k) => [k, k])) };
  const out = pickLangs(c, rng);
  assert.equal(out.length, 6);
  assert.ok(TIERS[0].includes(out[0]) && TIERS[2].includes(out[5]));
});
test('pickLangs skips missing languages', () => {
  const c = { l: { zh: 'a', ja: 'b', ru: 'c', pl: 'd', de: 'e', fr: 'f', ko: 'x' } };
  assert.ok(pickLangs(c, rng).every((k) => c.l[k]));
});
