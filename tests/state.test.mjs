import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TESTS } from '../web/color.js';
import * as S from '../web/state.js';

const level = { hex: '#FF724C', clues: ['a', 'b', 'c'] };
const tryHex = (g, hex) => S.test(S.pick(g, hex), level);

test('day numbers count local calendar days from the epoch', () => {
  assert.equal(S.dayNumber(new Date(2026, 9, 17, 0, 5), '2026-10-17'), 1);
  assert.equal(S.dayNumber(new Date(2026, 9, 17, 23, 59), '2026-10-17'), 1);
  assert.equal(S.dayNumber(new Date(2026, 9, 24, 12), '2026-10-17'), 8);
  assert.equal(S.dayNumber(new Date(2026, 10, 2, 12), '2026-10-17'), 17); // across the DST change
  assert.equal(S.dateOf(8, '2026-10-17'), '2026-10-24');
});
test('picking only takes valid hex colors, and any number of times', () => {
  let g = S.newGame();
  assert.equal(S.pick(g, 'red'), g);
  g = S.pick(S.pick(g, '#112233'), '#FF8040');
  assert.equal(g.pick, '#FF8040');
});
test('testing needs a picked color not tested before, and records accuracy and a hint', () => {
  let g = S.newGame();
  assert.equal(S.canTest(g), false);
  g = tryHex(g, '#FF8040');
  assert.equal(g.tests.length, 1);
  const t = g.tests[0];
  assert.equal(t.hex, '#FF8040');
  assert.ok(t.acc > 0 && t.acc <= 100);
  assert.equal(t.hint.length, 3);
  assert.equal(S.canTest(g), false, 'same color cannot be tested twice');
  g = S.pick(S.pick(g, '#000000'), '#FF8040');
  assert.equal(S.canTest(g), false, 'not even after moving away and back');
});
test('the picker is free between tests: nothing carries over', () => {
  let g = tryHex(S.newGame(), '#0000FF');
  g = tryHex(g, '#FF724C');
  assert.equal(g.tests[1].acc, 100);
});
test('the sixth test locks the game in', () => {
  let g = S.newGame();
  for (let i = 0; i < MAX_TESTS; i++) g = tryHex(g, `#0000${String(i).padStart(2, '0')}`);
  assert.equal(g.done, true);
  assert.equal(S.canPick(g), false);
});
test('points: best test, -3 per extra test, -5 per extra clue', () => {
  let g = tryHex(S.newGame(), '#FF8050');
  const first = g.tests[0].acc;
  assert.equal(S.points(g), Math.round(first));
  g = S.revealClue(g, level);
  assert.equal(S.points(g), Math.round(first - 5));
  g = tryHex(g, '#202020'); // worse
  assert.equal(S.points(g), Math.round(first - 5 - 3));
  assert.equal(S.best(g).acc, first);
});
test('clues stop at the last one', () => {
  let g = S.newGame();
  for (let i = 0; i < 5; i++) g = S.revealClue(g, level);
  assert.equal(g.clues, 3);
});
test('lock needs at least one test, then freezes the game', () => {
  let g = S.lock(S.pick(S.newGame(), '#FFE100'));
  assert.equal(g.done, false);
  g = S.lock(S.test(g, level));
  assert.equal(g.done, true);
  assert.equal(S.pick(g, '#000000'), g);
});
test('revive restores a saved game and rejects junk', () => {
  const g = S.pick(tryHex(S.newGame(), '#40C0A0'), '#123456');
  assert.deepEqual(S.revive(JSON.parse(JSON.stringify(g))), g);
  assert.deepEqual(S.revive({ pick: '#123456', tests: [{ hex: 'nope' }] }), S.newGame());
  assert.deepEqual(S.revive('nope'), S.newGame());
  assert.deepEqual(S.revive({ pick: 'nope', tests: [] }), S.newGame());
});
test('revive keeps tests saved by the paint-mixing version', () => {
  const old = { committed: [0, 0, 0, 1, 1], pending: [4], tests: [{ counts: [0, 0, 0, 1, 1], hex: '#F04030', acc: 70.1, hint: [] }], clues: 2, done: false };
  const g = S.revive(old);
  assert.equal(g.pick, '#F04030');
  assert.deepEqual(g.tests, [{ hex: '#F04030', acc: 70.1, hint: [] }]);
  assert.equal(g.clues, 2);
  assert.equal(S.canTest(g), false);
});
