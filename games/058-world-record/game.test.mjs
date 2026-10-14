import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtT, dropPct, yearCell, lengthCell } from './game.js';

test('fmtT', () => {
  assert.equal(fmtT(5.5), '5.50 s');
  assert.equal(fmtT(125), '2:05');
  assert.equal(fmtT(3725), '1:02:05');
});
test('dropPct', () => assert.equal(dropPct([[0, 100], [1, 40]]), 60));
test('yearCell', () => {
  assert.equal(yearCell({ year: 1990 }, { year: 1990 }).state, 'hit');
  assert.match(yearCell({ year: 1985 }, { year: 1996 }).text, /↑/);
  assert.equal(yearCell({ year: 1995 }, { year: 1996 }).state, 'near');
});
test('lengthCell', () => {
  assert.equal(lengthCell({ wr: 100 }, { wr: 100 }).state, 'hit');
  assert.match(lengthCell({ wr: 1000 }, { wr: 100 }).text, /↓/);
});
