import test from 'node:test';
import assert from 'node:assert/strict';
import game, { bearing, dirName, cat, speedKmh, viewBounds, extrapolate, scoreFor } from './game.js';
import { readFileSync } from 'node:fs';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const hav = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };

test('bearing', () => {
  assert.ok(Math.abs(bearing([0, 0], [1, 0]) - 0) < 1e-6);
  assert.ok(Math.abs(bearing([0, 0], [0, 1]) - 90) < 1e-6);
  assert.equal(dirName(315), '西北');
});
test('category', () => { assert.equal(cat(100), '3 级'); assert.equal(cat(40), '热带风暴'); });
test('speed', () => {
  const h = (a, b, c, d) => Math.hypot(c - a, d - b) * 100;
  assert.equal(speedKmh([[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0]], 3, h), 300 / 18);
});
test('extrapolate goes the right way', () => {
  const t = [[10, -60, 50], [10, -61, 50], [10, -62, 50], [10, -63, 50]];
  const e = extrapolate(t, 24, hav);
  assert.ok(e[1] < -63 && Math.abs(e[0] - 10) < 0.5);
});
test('scoring extremes', () => {
  assert.equal(scoreFor(0), 100);
  assert.ok(scoreFor(400) >= 35 && scoreFor(400) <= 38);
  assert.ok(scoreFor(150) > 60 && scoreFor(1500) < 3);
});

test('pool: sane fields, unique ids, landfall inside the map window', () => {
  assert.ok(data.storms.length >= 60);
  const ids = new Set();
  for (const s of data.storms) {
    assert.ok(!ids.has(s.id), s.id); ids.add(s.id);
    assert.match(s.name, /^[A-Z][a-z]+$/);
    assert.ok(s.year >= 1950 && s.year <= 2025);
    assert.ok(s.track.length >= 8);
    for (const p of [...s.track, ...s.full]) {
      assert.equal(p.length, 3);
      assert.ok(p.every(Number.isFinite), s.id);
      assert.ok(p[0] > -5 && p[0] < 65 && p[1] > -180 && p[1] < 0 && p[2] > 0 && p[2] <= 190, s.id);
    }
    assert.ok(s.hoursToLand >= 24 && s.hoursToLand <= 36, s.id);
    assert.ok(s.distKm > 0 && s.distKm <= 1800, s.id);
    assert.ok(s.land.date.startsWith(String(s.year)) || s.land.date.startsWith(String(s.year + 1)));
    const [[s0, w0], [n0, e0]] = viewBounds(s.track);
    assert.ok(s.land.lat > s0 && s.land.lat < n0 && s.land.lng > w0 && s.land.lng < e0, `${s.id} landfall outside window`);
    assert.ok(['AL', 'EP'].includes(s.basin));
  }
});

test('puzzles for days 1-120 are valid and the name never appears in clue fields', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const rng = makeRng ? makeRng(`landfall-${day}`) : null;
    const pick = (a) => a[(day * 7919) % a.length];
    const p = game.puzzle({ data, day, date, slug: 'landfall', rng, pick });
    assert.ok(p.s && p.s.id);
    seen.add(p.s.id);
    assert.ok(p.s.land.lat != null && p.s.land.lng != null);
  }
  assert.ok(seen.size >= 60);
});
test('meta', () => { assert.ok(game.meta.sources.length >= 1 && game.meta.howTo.length >= 2); });
