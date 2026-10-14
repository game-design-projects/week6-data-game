import test from 'node:test';
import assert from 'node:assert/strict';
import game, { bearing, dirName, cat, speedKmh } from './game.js';
import { readFileSync } from 'node:fs';

test('bearing', () => {
  assert.ok(Math.abs(bearing([0, 0], [1, 0]) - 0) < 1e-6);
  assert.ok(Math.abs(bearing([0, 0], [0, 1]) - 90) < 1e-6);
  assert.equal(dirName(315), '西北');
});
test('category', () => { assert.equal(cat(100), '3 级'); assert.equal(cat(40), '热带风暴'); });
test('speed', () => {
  const hav = (a, b, c, d) => Math.hypot(c - a, d - b) * 100;
  assert.equal(speedKmh([[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0]], 3, hav), 300 / 18);
});
test('data sane', () => {
  const d = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
  assert.ok(d.storms.length >= 60);
  for (const s of d.storms) assert.ok(s.track.length >= 8 && s.land.lat != null);
  assert.ok(game.meta.sources.length);
});
