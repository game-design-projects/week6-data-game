import test from 'node:test';
import assert from 'node:assert/strict';
import game, { gcPoints, areaBetween, scoreFor, merc } from './game.js';
import { readFileSync } from 'node:fs';

const NYC = { lat: 40.71, lng: -74 }, LON = { lat: 51.5, lng: -0.12 };
test('gc endpoints and arc bulges poleward', () => {
  const g = gcPoints(NYC, LON);
  assert.ok(Math.abs(g[0][0] - NYC.lat) < 1e-6 && Math.abs(g.at(-1)[1] - LON.lng) < 1e-6);
  assert.ok(Math.max(...g.map((p) => p[0])) > 51.5);
});
test('identical path gives zero area, full score', () => {
  const g = gcPoints(NYC, LON);
  const r = areaBetween(g, g, NYC.lng, LON.lng);
  assert.ok(r.mean < 1e-9);
  assert.equal(scoreFor(0), 100);
});
test('straight line scores lower than gc, monotone', () => {
  const g = gcPoints(NYC, LON);
  const s = areaBetween([[NYC.lat, NYC.lng], [LON.lat, LON.lng]], g, NYC.lng, LON.lng);
  assert.ok(s.mean > 1 && scoreFor(s.mean) < 90 && scoreFor(s.mean) > 0);
  assert.ok(Math.abs(merc(0)) < 1e-9);
});
test('puzzle deterministic from data', () => {
  const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
  assert.ok(data.pairs.length >= 60);
  const pick = (a) => a[3];
  assert.deepEqual(game.puzzle({ data, pick }), game.puzzle({ data, pick }));
});
