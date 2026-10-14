import test from 'node:test';
import assert from 'node:assert/strict';
import { radiusFromDepth, flux, durationHours } from './game.js';
test('Jupiter around the Sun: ~1% -> ~11 Re', () => {
  assert.ok(Math.abs(radiusFromDepth(1.0, 1) - 10.9) < 0.5);
});
test('flux: outside transit is 1, centre is below 1', () => {
  assert.equal(flux(10, 0.01, 3, 0.1), 1);
  assert.ok(flux(0, 0.01, 3, 0.1) < 0.995);
});
test('duration sane', () => {
  const d = durationHours(3.5, 1);
  assert.ok(d > 1 && d < 6);
});
