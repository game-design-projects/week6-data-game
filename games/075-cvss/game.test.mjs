import test from 'node:test'; import assert from 'node:assert/strict';
import { parseVector, sevOf } from './game.js';
test('parseVector', () => { const v = parseVector('AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N'); assert.equal(v.length, 8); assert.deepEqual(v[0], ['攻击途径', '网络（远程）']); });
test('sevOf', () => { assert.equal(sevOf(9.8), '严重'); assert.equal(sevOf(7.5), '高危'); assert.equal(sevOf(4.3), '中危'); assert.equal(sevOf(0.1), '低危'); });
