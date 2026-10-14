import test from 'node:test';
import assert from 'node:assert/strict';
import game, { hm, speed } from './game.js';
import data from './data.json' with { type: 'json' };
test('hm formats', () => { assert.equal(hm(45), '45 分'); assert.equal(hm(125), '2 小时 05 分'); });
test('speed', () => assert.equal(speed(100, 60), 100));
test('data sane', () => { assert.ok(data.pairs.length >= 60); for (const p of data.pairs) assert.ok(p.min > 0 && p.km > 0 && p.km / p.min * 60 < 200); });
test('meta', () => assert.equal(game.meta.num, 86));
