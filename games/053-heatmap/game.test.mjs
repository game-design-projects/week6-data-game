import test from 'node:test';
import assert from 'node:assert/strict';
import { bucket, redactTitle } from './game.js';
test('bucket', () => { assert.equal(bucket(9.3), 4); assert.equal(bucket(8.2), 2); assert.equal(bucket(5), 0); });
test('redactTitle hides show words', () => {
  assert.equal(redactTitle('Breaking Bad finale', { title: 'Breaking Bad' }), '▇▇▇ Bad finale');
  assert.equal(redactTitle('Pilot', { title: 'Friends' }), 'Pilot');
});
