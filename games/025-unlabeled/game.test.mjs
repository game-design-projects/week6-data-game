import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { windows, monthKey, yearScore, recAt } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
test('windows >= 60 and in range', () => {
  const w = windows(data);
  assert.ok(w.length >= 60);
  for (const x of w) assert.ok(x.off + 180 <= data.series.find((s) => s.id === x.id).vals.length);
});
test('monthKey', () => { assert.deepEqual(monthKey('1948-01', 13), { y: 1949, m: 2 }); });
test('yearScore', () => { assert.equal(yearScore(2000, 2000), 100); assert.ok(yearScore(1990, 2000) < yearScore(1998, 2000)); });
test('recAt: 2020-04 is a recession, 2015-01 is not', () => { assert.ok(recAt(data.rec, 2020, 4)); assert.ok(!recAt(data.rec, 2015, 1)); });
