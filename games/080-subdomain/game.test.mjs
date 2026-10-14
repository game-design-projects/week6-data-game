import test from 'node:test';
import assert from 'node:assert/strict';
import { batches, hideBrand, CLUE_SIZES } from './game.js';

test('batches split labels in order', () => {
  const labels = Array.from({ length: 36 }, (_, i) => 'l' + i);
  const b = batches(labels);
  assert.equal(b.length, CLUE_SIZES.length);
  assert.deepEqual(b.flat(), labels);
});

test('hideBrand masks id and name', () => {
  const c = { id: 'stripe', name: 'Stripe' };
  assert.equal(hideBrand('Stripe-dev and stripe', c), '▇▇▇-dev and ▇▇▇');
});
