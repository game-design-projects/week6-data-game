import { test } from 'node:test';
import assert from 'node:assert/strict';
import game, { gmstDeg, altAz, project } from './game.js';
import data from './data.json' with { type: 'json' };

test('GMST at J2000 epoch', () => {
  assert.ok(Math.abs(gmstDeg(Date.UTC(2000, 0, 1, 12)) - 280.46) < 0.01);
});
test('Polaris altitude ≈ latitude', () => {
  const pol = data.stars.find((s) => s[4] === 11767);
  for (const lat of [20, 40.7, 60]) {
    const { alt } = altAz(pol[0], pol[1], lat, 123);
    assert.ok(Math.abs(alt - lat) < 1.6, `${lat} -> ${alt}`);
  }
});
test('zenith star and projection', () => {
  const a = altAz(100, 30, 30, 100);
  assert.ok(Math.abs(a.alt - 90) < 1e-6);
  assert.deepEqual(project(0, 0).y, -1);
});
test('puzzle deterministic, night-time, many days', () => {
  const seen = new Set();
  for (let d = 1; d <= 14; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    const rngStub = { float: (a, b) => a + (b - a) * 0.3 };
    const p = game.puzzle({ data, date, day: d, pick: (xs) => xs[d % xs.length], rng: rngStub });
    seen.add(p.city.name);
    assert.ok(p.solar >= 21 || p.solar <= 3);
  }
  assert.ok(seen.size >= 7);
});
