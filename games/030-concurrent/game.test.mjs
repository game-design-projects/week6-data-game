import test from 'node:test';
import assert from 'node:assert/strict';
import game, { localHour, peakShare, LANGS } from './game.js';
test('localHour wraps', () => {
  assert.equal(localHour(13.5, 9), '22:30');
  assert.equal(localHour(1.5, -5), '20:30');
  assert.equal(localHour(23.5, 3.5), '03:00');
});
test('peakShare', () => assert.equal(peakShare([1, 5, 2]), 5));
test('puzzle shape', () => {
  const share = Array(24).fill(4);
  const data = { day: 'd', puzzles: [{ games: ['G'], curves: { ja: { share }, en: { share } } }] };
  const p = game.puzzle({ data, pick: (a) => a[0] });
  assert.deepEqual(Object.keys(p.curves), ['ja', 'en']);
  assert.ok(LANGS.ja);
});
