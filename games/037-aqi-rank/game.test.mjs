import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import g, { mean, band } from './game.js';
test('mean skips nulls', () => assert.equal(mean([1, null, 3]), 2));
test('band', () => { assert.equal(band(5), '优'); assert.equal(band(200), '重度污染'); });
test('puzzle pool: 5 distinct cities, strictly ordered values', () => {
  const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
  for (const p of data.puzzles) { assert.equal(new Set(p.c).size, 5); const v = p.c.map((c) => data.pm[c][p.t]); assert.equal(new Set(v).size, 5); }
  assert.ok(data.puzzles.length >= 60);
});
