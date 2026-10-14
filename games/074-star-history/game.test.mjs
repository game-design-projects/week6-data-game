import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, shape } from './game.js';
test('redact hides repo and owner', () => {
  assert.equal(redact('React is a lib by facebook', 'facebook/react'), '▇▇▇ is a lib by ▇▇▇');
  assert.equal(redact(null, 'a/bcd'), '');
});
test('shape', () => {
  const s = shape([1, 1, 1, 1, 100]);
  assert.equal(s.peakIdx, 4); assert.equal(s.median, 1); assert.equal(s.ratio, 100);
  assert.ok(s.top3Share > 0.9);
});
