import test from 'node:test';
import assert from 'node:assert/strict';
import g, { km, bearing, extrapolate, compass } from './game.js';

test('km: 1 degree latitude ≈ 111 km', () => assert.ok(Math.abs(km([0, 0], [1, 0]) - 111.2) < 0.5));
test('bearing east / north', () => {
  assert.ok(Math.abs(bearing([0, 0], [0, 1]) - 90) < 0.01);
  assert.ok(Math.abs(bearing([0, 0], [1, 0])) < 0.01);
});
test('compass', () => { assert.equal(compass(0), '北'); assert.equal(compass(359), '北'); assert.equal(compass(90), '东'); });
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
