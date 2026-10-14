import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { fmtHM, perDoer, ACT } from './game.js';
const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
test('fmtHM', () => { assert.equal(fmtHM(45), '45 分钟'); assert.equal(fmtHM(125), '2 小时 5 分'); });
test('perDoer', () => { assert.equal(perDoer(30, 50), 60); assert.equal(perDoer(30, 0), 30); });
test('data: every question activity is labelled and positive', () => {
  for (const g of data.groups) {
    assert.ok(g.v.AC01[0] > 300);
    for (const [k, [m]] of Object.entries(g.v)) if (k !== 'AC01') { assert.ok(ACT[k], k); assert.ok(m >= 3 && m <= 720); }
  }
});
