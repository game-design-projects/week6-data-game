import test from 'node:test';
import assert from 'node:assert/strict';
import { roughFare, whenParts, fmtMin } from './game.js';
test('roughFare', () => assert.equal(roughFare(2), 10));
test('whenParts', () => {
  const w = whenParts('2023-03-04T08:15');
  assert.equal(w.wd, '周六'); assert.equal(w.hhmm, '08:15'); assert.equal(w.slot, '早高峰前后');
});
test('fmtMin', () => { assert.equal(fmtMin(25), '25 分钟'); assert.equal(fmtMin(75), '1 小时 15 分'); });
