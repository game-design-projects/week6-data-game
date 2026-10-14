import test from 'node:test';
import assert from 'node:assert/strict';
import { compare, aliasesOf, yearStr, spanStr } from './game.js';
import { redactTitle } from './build/build-helpers.mjs';

const H = (first, last, cont) => ({ first, last, cont });
test('era direction and continent', () => {
  const [era, reg] = compare(H(1500, 1700, ['Europe']), H(900, 1100, ['Europe']));
  assert.match(era.text, /偏晚/); assert.equal(reg.state, 'hit');
  const [e2, r2] = compare(H(1000, 1100, ['Asia']), H(1000, 1100, ['Europe']));
  assert.equal(e2.state, 'hit'); assert.equal(r2.state, 'miss');
});
test('aliases and years', () => {
  assert.deepEqual(aliasesOf('House of Bourbon'), ['Bourbon']);
  assert.deepEqual(aliasesOf('Ming dynasty'), ['Ming']);
  assert.equal(yearStr(-500), '前500');
  assert.equal(spanStr({ by: 1000, dy: null }), '1000–');
});
test('title redaction hides place', () => {
  assert.equal(redactTitle('King of England'), 'King of ▇▇▇');
  assert.equal(redactTitle('Pharaoh'), 'Pharaoh');
});
