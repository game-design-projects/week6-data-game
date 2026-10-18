import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POT_CAPACITY, MAX_TESTS, PAINTS } from '../web/color.js';
import * as S from '../web/state.js';

const level = { hex: '#FF724C', clues: ['a', 'b', 'c'] };
const drops = (g, ...ids) => ids.reduce((acc, id) => S.addDrop(acc, PAINTS.findIndex(p => p.id === id)), g);

test('day numbers count local calendar days from the epoch', () => {
  assert.equal(S.dayNumber(new Date(2026, 9, 17, 0, 5), '2026-10-17'), 1);
  assert.equal(S.dayNumber(new Date(2026, 9, 17, 23, 59), '2026-10-17'), 1);
  assert.equal(S.dayNumber(new Date(2026, 9, 24, 12), '2026-10-17'), 8);
  assert.equal(S.dayNumber(new Date(2026, 10, 2, 12), '2026-10-17'), 17); // across the DST change
  assert.equal(S.dateOf(8, '2026-10-17'), '2026-10-24');
});
test('drops fill the pot up to its capacity', () => {
  let g = S.newGame();
  for (let i = 0; i < POT_CAPACITY + 5; i++) g = S.addDrop(g, 0);
  assert.equal(S.potTotal(g), POT_CAPACITY);
  assert.equal(S.canDrop(g), false);
});
test('undo removes only paint added since the last test', () => {
  let g = drops(S.newGame(), 'M', 'Y');
  g = S.test(g, level);
  assert.deepEqual(g.pending, []);
  assert.equal(S.canUndo(g), false);
  assert.equal(S.undo(g), g);
  g = drops(g, 'W');
  g = S.undo(g);
  assert.equal(S.potTotal(g), 2);
});
test('testing needs new paint and records accuracy and a hint', () => {
  let g = S.newGame();
  assert.equal(S.canTest(g), false);
  g = S.test(drops(g, 'M', 'Y', 'W'), level);
  assert.equal(g.tests.length, 1);
  const t = g.tests[0];
  assert.match(t.hex, /^#[0-9A-F]{6}$/);
  assert.ok(t.acc > 0 && t.acc <= 100);
  assert.equal(t.hint.length, 3);
  assert.equal(S.canTest(g), false, 'same pot cannot be tested twice');
});
test('the sixth test locks the game in', () => {
  let g = S.newGame();
  for (let i = 0; i < MAX_TESTS; i++) g = S.test(drops(g, 'Y'), level);
  assert.equal(g.done, true);
  assert.equal(S.canDrop(g), false);
});
test('points: best test, -3 per extra test, -5 per extra clue', () => {
  let g = S.test(drops(S.newGame(), 'M', 'Y', 'Y', 'W'), level);
  const first = g.tests[0].acc;
  assert.equal(S.points(g), Math.round(first));
  g = S.revealClue(g, level);
  assert.equal(S.points(g), Math.round(first - 5));
  g = S.test(drops(g, 'K', 'K', 'K'), level); // worse
  assert.equal(S.points(g), Math.round(first - 5 - 3));
  assert.equal(S.best(g).acc, first);
});
test('clues stop at the last one', () => {
  let g = S.newGame();
  for (let i = 0; i < 5; i++) g = S.revealClue(g, level);
  assert.equal(g.clues, 3);
});
test('lock needs at least one test, then freezes the game', () => {
  let g = S.lock(drops(S.newGame(), 'Y'));
  assert.equal(g.done, false);
  g = S.lock(S.test(g, level));
  assert.equal(g.done, true);
  assert.equal(S.addDrop(g, 0), g);
});
test('revive restores a saved game and rejects junk', () => {
  const g = S.test(drops(S.newGame(), 'C', 'Y'), level);
  assert.deepEqual(S.revive(JSON.parse(JSON.stringify(g))), g);
  assert.deepEqual(S.revive({ committed: [1, 2], pending: [], tests: [] }), S.newGame());
  assert.deepEqual(S.revive('nope'), S.newGame());
  assert.deepEqual(S.revive({ ...g, pending: [99] }), S.newGame());
});
