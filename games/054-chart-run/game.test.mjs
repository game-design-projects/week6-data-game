import test from 'node:test';
import assert from 'node:assert/strict';
import game, { yearScore, yearOf } from './game.js';
import data from './data.json' with { type: 'json' };
test('yearScore', () => { assert.equal(yearScore(1990, 1990), 100); assert.ok(yearScore(1995, 1990) < 40 && yearScore(1995, 1990) > 35); });
test('yearOf', () => assert.equal(yearOf('1999-05-01'), 1999));
test('data integrity', () => { for (const p of data.puzzles) { assert.ok(data.options[p.o]); assert.ok(p.run.some((x) => x === data.options[p.o].k)); } assert.ok(data.puzzles.length >= 60); });
