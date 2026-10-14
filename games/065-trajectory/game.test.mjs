import test from 'node:test';
import assert from 'node:assert/strict';
import { worstDip, at, firstAbove } from './game.js';
const pts = [[1800, 500, 30], [1802, 520, 32], [1804, 530, 25], [1806, 600, 40]];
test('worstDip', () => assert.deepEqual(worstDip(pts), { drop: 7, year: 1804 }));
test('at', () => assert.equal(at(pts, 1803)[0], 1802));
test('firstAbove', () => { assert.equal(firstAbove(pts, 35), 1806); assert.equal(firstAbove(pts, 90), null); });
