import test from 'node:test';
import assert from 'node:assert/strict';
import g, { magScore, nearby } from './game.js';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
test('magScore', () => { assert.equal(magScore(6, 6), 100); assert.ok(magScore(6.6, 6) < 40 && magScore(6.6, 6) > 35); });
test('nearby', () => { assert.equal(nearby([[0, 0, 3], [50, 50, 3]], 0, 0, 100, (a, b, c, d) => Math.hypot(a - c, b - d) * 100).length, 1); });
test('data', () => { assert.ok(data.puzzles.length >= 60); for (const p of data.puzzles) assert.ok(p.top.mag > p.others[0][2]); });
test('puzzle shape', () => { assert.ok(g.meta.howTo.length >= 2); });
