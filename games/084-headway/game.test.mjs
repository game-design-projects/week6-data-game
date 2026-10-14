import test from 'node:test';
import assert from 'node:assert/strict';
import { judge, grade, noteTimes, SPEED } from './game.js';

test('judge windows', () => {
  assert.equal(judge(0.05), 100);
  assert.equal(judge(-0.1), 70);
  assert.equal(judge(0.2), 40);
  assert.equal(judge(0.4), 0);
});
test('noteTimes compresses minutes', () => {
  assert.deepEqual(noteTimes({ notes: [[60, 'A'], [120, 'C']] }), [SPEED, 2 * SPEED]);
});
test('grade perfect and stray', () => {
  const t = [1, 3, 5];
  assert.equal(grade(t, [1, 3, 5]).score, 100);
  assert.equal(grade(t, [1, 3, 5, 9]).score, 96);
  assert.equal(grade(t, []).score, 0);
});
test('a tap only matches one note', () => {
  const g = grade([1, 1.1], [1.05]);
  assert.equal(g.res.filter((r) => r.pts).length, 1);
});
