import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, yearsWithWeekday } from './game.js';

test('summarize counts cities and types', () => {
  const s = summarize([
    ['2020-01-01', 40, -74, 'NYC', 'MSG', 'Indoor arena'],
    ['2020-01-02', 40, -74, 'NYC', 'MSG', 'Indoor arena'],
    ['2020-01-10', 51.5, 0, 'London', 'O2', 'Arena'],
  ]);
  assert.equal(s.n, 3);
  assert.equal(s.cities, 2);
  assert.deepEqual(s.top[0], ['NYC', 2]);
  assert.equal(s.spanDays, 9);
  assert.ok(s.km > 5000 && s.km < 6000);
});

test('yearsWithWeekday', () => {
  // 2017-05-10 was a Wednesday
  const ys = yearsWithWeekday('05-10', 3);
  assert.ok(ys.includes(2017));
  assert.ok(!ys.includes(2018));
});
