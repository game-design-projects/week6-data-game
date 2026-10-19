// The score server's checks and scoring (worker/scores.js); the D1 queries are exercised with `wrangler dev`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRound, cleanName } from '../worker/scores.js';
import { LEVELS } from '../web/levels.js';
import { accuracy } from '../web/color.js';

const now = new Date('2026-10-19T15:00:00Z'); // day 3
const round = over => ({ day: 3, device: 'device-1234', name: 'Steven', tests: ['#C9906A', LEVELS[2].hex], ...over });

test('a round is scored from its colors, like the game does', () => {
  const { row } = scoreRound(round(), now);
  assert.equal(row.acc, 100);
  assert.equal(row.pts, 97); // best match, minus 3 for the second test
  assert.equal(row.hex, LEVELS[2].hex);
  assert.equal(row.tests, 2);
  const { row: one } = scoreRound(round({ tests: ['#808080'] }), now);
  assert.equal(one.pts, Math.round(accuracy('#808080', LEVELS[2].hex)));
});
test('lowercase hex is fine; junk, repeats and too many tests are not', () => {
  assert.ok(scoreRound(round({ tests: [LEVELS[2].hex.toLowerCase()] }), now).row);
  assert.match(scoreRound(round({ tests: [] }), now).error, /tests/);
  assert.match(scoreRound(round({ tests: ['red'] }), now).error, /tests/);
  assert.match(scoreRound(round({ tests: ['#000000', '#000000'] }), now).error, /tests/);
  assert.match(scoreRound(round({ tests: Array.from({ length: 7 }, (_, i) => `#00000${i}`) }), now).error, /tests/);
});
test('only days that exist so far, give or take a time zone', () => {
  assert.ok(scoreRound(round({ day: 4 }), now).row, 'tomorrow in UTC is today somewhere');
  assert.equal(scoreRound(round({ day: 5 }), now).error, 'bad day');
  assert.equal(scoreRound(round({ day: 0 }), now).error, 'bad day');
  assert.equal(scoreRound(round({ day: '3' }), now).error, 'bad day');
});
test('device ids and names are checked', () => {
  assert.equal(scoreRound(round({ device: 'short' }), now).error, 'bad device id');
  assert.equal(scoreRound(round({ device: 'has spaces in it' }), now).error, 'bad device id');
  assert.equal(scoreRound(null, now).error, 'expected a JSON object');
  assert.equal(cleanName('  Gx   Tactics \n'), 'Gx Tactics');
  assert.equal(cleanName(''), 'Anonymous');
  assert.equal(cleanName('a\u0000b‮c'), 'abc');
  assert.equal(cleanName('x'.repeat(40)).length, 24);
});
