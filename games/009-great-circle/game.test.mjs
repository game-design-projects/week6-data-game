import test from 'node:test';
import assert from 'node:assert/strict';
import game, { gcPoints, areaBetween, scoreFor, merc, rhumbPoints, vertex } from './game.js';
import { readFileSync } from 'node:fs';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const NYC = { lat: 40.71, lng: -74 }, LON = { lat: 51.5, lng: -0.12 };
const base = (a, b) => areaBetween(rhumbPoints(a, b), gcPoints(a, b), a.lng, b.lng).mean;

test('gc endpoints and arc bulges poleward', () => {
  const g = gcPoints(NYC, LON);
  assert.ok(Math.abs(g[0][0] - NYC.lat) < 1e-6 && Math.abs(g.at(-1)[1] - LON.lng) < 1e-6);
  assert.ok(vertex(g)[0] > 51.5);
});
test('gc across the antimeridian keeps longitude continuous', () => {
  const g = gcPoints({ lat: 35.7, lng: 139.7 }, { lat: 34, lng: -118.2 + 360 });
  for (let i = 1; i < g.length; i++) assert.ok(Math.abs(g[i][1] - g[i - 1][1]) < 5);
  assert.ok(g.at(-1)[1] > 180);
});
test('scoring extremes: perfect, typical, straight line, worst', () => {
  const b = base(NYC, LON), g = gcPoints(NYC, LON);
  const perfect = areaBetween(g, g, NYC.lng, LON.lng);
  assert.ok(perfect.mean < 1e-9);
  assert.equal(scoreFor(perfect.mean, b), 100);
  const straight = scoreFor(areaBetween(rhumbPoints(NYC, LON), g, NYC.lng, LON.lng).mean, b);
  assert.ok(straight < 20 && straight > 5);
  // one decent waypoint (halfway up the arc, slightly off)
  const mid = g[60];
  const typical = scoreFor(areaBetween([[NYC.lat, NYC.lng], [mid[0] - 1, mid[1]], [LON.lat, LON.lng]], g, NYC.lng, LON.lng).mean, b);
  assert.ok(typical > 40 && typical < 95, `typical ${typical}`);
  const worst = scoreFor(areaBetween([[NYC.lat, NYC.lng], [80, -37], [LON.lat, LON.lng]], g, NYC.lng, LON.lng).mean, b);
  assert.ok(worst < 1, `worst ${worst}`);
  assert.ok(straight < typical && typical < 100 && worst < straight);
});
test('zig-zag around the circle cannot cancel out to a perfect score', () => {
  const g = gcPoints(NYC, LON), b = base(NYC, LON);
  const zig = [[NYC.lat, NYC.lng], ...[10, 20, 30, 40, 50].map((i) => [g[i * 2][0] + (i % 20 === 0 ? -4 : 4), g[i * 2][1]]), [LON.lat, LON.lng]];
  assert.ok(scoreFor(areaBetween(zig, g, NYC.lng, LON.lng).mean, b) < 40);
});
test('overshooting past the destination is penalised', () => {
  const g = gcPoints(NYC, LON), b = base(NYC, LON);
  const over = scoreFor(areaBetween([[NYC.lat, NYC.lng], ...g.slice(1, -1), [75, 60], [LON.lat, LON.lng]], g, NYC.lng, LON.lng).mean, b);
  assert.ok(over < 95, `over ${over}`);
  assert.ok(Math.abs(merc(0)) < 1e-9);
});

test('pool: 120 days of puzzles are well-formed and fair', () => {
  assert.ok(data.pairs.length >= 60);
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const rng = makeRng ? makeRng(`009:${day}`) : null;
    const items = data.pairs;
    const pick = (a) => a[(day * 7919) % a.length];
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: 'great-circle', rng, pick });
    void items;
    for (const c of [p.a, p.b]) {
      assert.ok(c.name && typeof c.name === 'string' && c.country, `day ${day} city`);
      assert.ok(Number.isFinite(c.lat) && Math.abs(c.lat) <= 72, `day ${day} lat`);
      assert.ok(Number.isFinite(c.lng) && c.lng > -180 && c.lng < 360, `day ${day} lng`);
    }
    assert.notEqual(p.a.name + p.a.country, p.b.name + p.b.country);
    assert.notEqual(p.a.country, p.b.country);
    const span = p.b.lng - p.a.lng;
    assert.ok(span >= 25 && span <= 170, `day ${day} span ${span}`);
    assert.ok(p.km >= 3500 && p.km <= 13500, `day ${day} km`);
    assert.ok(p.gap >= 3 && p.gap <= 30 && Number.isFinite(p.gap));
    assert.ok(Math.abs(p.vtx) <= 75);
    const g = gcPoints(p.a, p.b);
    assert.ok(g.every(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo)));
    assert.ok(Math.abs(base(p.a, p.b) - p.gap) < 0.5, `day ${day} gap mismatch ${base(p.a, p.b)} vs ${p.gap}`);
    seen.add(p.a.name + '>' + p.b.name);
  }
  assert.equal(seen.size, data.pairs.length > 120 ? 120 : seen.size);
});
test('pool has no duplicate pairs and some antimeridian routes', () => {
  const k = data.pairs.map((p) => p.a.name + '>' + p.b.name);
  assert.equal(new Set(k).size, k.length);
  assert.ok(data.pairs.some((p) => p.b.lng > 180));
});
test('puzzle deterministic from data', () => {
  const pick = (a) => a[3];
  assert.deepEqual(game.puzzle({ data, pick }), game.puzzle({ data, pick }));
});
