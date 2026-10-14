import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { liftText } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('liftText formats ratio', () => assert.equal(liftText(['RAM', 1.98, 3.2]), '2.0× 全州平均'));
test('62 counties, each top-10 sums below 100% and is sorted', () => {
  assert.equal(data.counties.length, 62);
  for (const c of data.counties) {
    assert.equal(c.top.length, 10);
    assert.ok(c.top.reduce((a, t) => a + t[1], 0) <= 100.5);
    for (let i = 1; i < 10; i++) assert.ok(c.top[i - 1][1] >= c.top[i][1]);
    for (const [k] of c.top) assert.ok(data.makes[k], k);
  }
});
