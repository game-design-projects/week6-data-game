import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, hpOf, costOf, score, L } from './game.js';
const qs = [{ m: 4.5 }, { m: 5.0 }, { m: 6.0 }];
test('hp grows with magnitude', () => { assert.equal(hpOf(4.5), 8); assert.ok(hpOf(6) > hpOf(5)); });
test('no towers means no damage', () => { const r = simulate(qs, Array(L).fill(0)); assert.equal(r.killedHP, 0); assert.equal(r.leaked.length, 3); });
test('cannons kill small enemies', () => { const l = Array(L).fill(0); l[3] = 2; l[4] = 2; const r = simulate(qs, l); assert.ok(r.kills >= 1); assert.ok(r.killedHP > 0); });
test('cost and score', () => { assert.equal(costOf([1, 2, 3]), 6); assert.equal(score(50, 100), 50); assert.equal(score(200, 100), 100); });
