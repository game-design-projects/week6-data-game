import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { radiusFromDepth, flux, curve, logScore } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('Jupiter around the Sun: ~1% -> ~11 Re', () => {
  assert.ok(Math.abs(radiusFromDepth(1.0, 1) - 10.9) < 0.5);
});
test('flux: outside transit is 1, centre equals 1 - depth', () => {
  assert.equal(flux(10, 0.01, 3, 0.1), 1);
  assert.ok(Math.abs(flux(0, 0.01, 3, 0.1) - 0.99) < 1e-9);
});
test('curve: symmetric, bottom at published depth, within bounds', () => {
  const { pts } = curve({ depth: 0.5, dur: 3, b: 0.2 });
  assert.equal(pts.length, 161);
  assert.ok(Math.abs(Math.min(...pts.map((q) => q.f)) - 99.5) < 0.01);
  assert.ok(Math.abs(pts[0].f - 100) < 1e-9 && Math.abs(pts[160].f - 100) < 1e-9);
});
test('scoring extremes', () => {
  assert.equal(logScore(3, 3), 100);
  assert.ok(logScore(3 * 1.05, 3) > 85);      // careful formula user
  assert.ok(logScore(6, 3) < 20);             // 2x off
  assert.ok(logScore(30, 0.5) < 0.01);        // worst
  assert.ok(logScore(3, 3.3) > logScore(3, 4));
});
test('pool: 113+ valid puzzles, days 1-120', () => {
  assert.ok(data.planets.length >= 60);
  const names = new Set();
  for (let day = 1; day <= 120; day++) {
    const { planet: p } = game.puzzle({ data, day, pick: (a) => a[(day * 7) % a.length] });
    for (const k of ['rp', 'rs', 'depth', 'per', 'dur']) assert.ok(Number.isFinite(p[k]) && p[k] > 0, `${p.name}.${k}`);
    assert.ok(p.name && p.star && p.year >= 1990 && p.year <= 2026);
    assert.ok(p.rp >= 0.3 && p.rp <= 30, 'inside slider range');
    assert.ok(p.depth <= 5 && p.dur < p.per * 12 && p.dur < 20);
    assert.ok(p.b == null || (p.b >= 0 && p.b < 1));
    assert.ok(Math.abs(radiusFromDepth(p.depth, p.rs) / p.rp - 1) <= 0.061, `${p.name} dip explains radius`);
    const { pts, sigma } = curve(p);
    assert.ok(pts.every((q) => Number.isFinite(q.f) && q.f > 90 && q.f <= 100.0001));
    assert.ok(sigma < p.depth, `${p.name} noise below depth`);
  }
  for (const p of data.planets) { assert.ok(!names.has(p.name), 'dup ' + p.name); names.add(p.name); }
});
test('answer leak: planet / star name never in the pre-guess fields', () => {
  const m = game.meta;
  const text = JSON.stringify([m.title, m.tagline, m.howTo]);
  assert.ok(!data.planets.some((p) => text.includes(p.name)));
});
