import test from 'node:test';
import assert from 'node:assert/strict';
import g, { km, bearing, extrapolate, compass } from './game.js';

test('km: 1 degree latitude ≈ 111 km', () => assert.ok(Math.abs(km([0, 0], [1, 0]) - 111.2) < 0.5));
test('bearing east / north', () => {
  assert.ok(Math.abs(bearing([0, 0], [0, 1]) - 90) < 0.01);
  assert.ok(Math.abs(bearing([0, 0], [1, 0])) < 0.01);
});
test('compass', () => { assert.equal(compass(0), 'north'); assert.equal(compass(359), 'north'); assert.equal(compass(90), 'east'); });
test('extrapolate is linear', () => {
  const t = Array.from({ length: 91 }, (_, i) => [i * 0.1, i * 0.2]);
  const e = extrapolate(t);
  assert.ok(Math.abs(e[0] - 9) < 1e-9 && Math.abs(e[1] - 18) < 1e-9);
});
test('puzzle returns a 91-point track', () => {
  const track = Array.from({ length: 91 }, (_, i) => [i, i]);
  const p = g.puzzle({ data: { drifters: [{ id: '1', start: '2020-01-01', drogued: true, track }] }, pick: (a) => a[0] });
  assert.equal(p.track.length, 91);
});

import { scaleFor, viewFor, inBounds } from './game.js';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('pool: 120 days all valid, ids unique per day window, answer inside map view', () => {
  assert.ok(data.drifters.length >= 60);
  const ids = new Set(data.drifters.map((d) => d.id));
  assert.equal(ids.size, data.drifters.length, 'duplicate drifter ids');
  const days = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = g.puzzle({ data, day, date: '2026-10-01', slug: 'drift', rng: null, pick: (a) => a[(day - 1) % a.length] });
    days.add(p.id);
    assert.equal(p.track.length, 91);
    assert.match(p.start, /^\d{4}-\d\d-\d\d$/);
    for (const [la, lo] of p.track) {
      assert.ok(Number.isFinite(la) && Number.isFinite(lo));
      assert.ok(la >= -90 && la <= 90 && lo >= -180 && lo <= 180);
    }
    const d10 = km(p.track[0], p.track[10]);
    assert.ok(d10 > 3 && d10 < 1500, `d10 ${d10}`);
    const sc = scaleFor(d10);
    assert.ok(sc >= 300 && sc <= 1000);
    assert.ok(inBounds(viewFor(p.track), p.track[90]), `${p.id} day-90 outside view`);
    assert.equal(typeof p.drogued, 'boolean');
  }
  assert.ok(days.size >= 60);
});

test('scoring extremes: exact 100, at-scale ~37, far ~0; scale monotone in speed', () => {
  const s = (d, sc) => 100 * Math.exp(-d / sc);
  assert.equal(s(0, 500), 100);
  assert.ok(Math.abs(s(500, 500) - 36.8) < 0.1);
  assert.ok(s(5000, 500) < 0.1);
  assert.ok(scaleFor(0) === 300 && scaleFor(10000) === 1000 && scaleFor(100) < scaleFor(200));
});

test('guessing day-10 position (the naive baseline) scores modestly, not trivially', () => {
  const sc = data.drifters.map((d) => 100 * Math.exp(-km(d.track[10], d.track[90]) / scaleFor(km(d.track[0], d.track[10])))).sort((a, b) => a - b);
  const med = sc[Math.floor(sc.length / 2)];
  console.log('baseline median score', med.toFixed(1));
  assert.ok(med > 10 && med < 70);
});
