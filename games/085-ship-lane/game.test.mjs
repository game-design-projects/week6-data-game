import test from 'node:test';
import assert from 'node:assert/strict';
import { distKm, bearing, arrow } from './geo.js';
test('distance', () => {
  assert.ok(Math.abs(distKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.2) < 1);
  assert.equal(distKm({ lat: 5, lng: 5 }, { lat: 5, lng: 5 }), 0);
});
test('bearing', () => {
  assert.equal(arrow(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })), '↑');
  assert.equal(arrow(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })), '→');
  assert.equal(arrow(bearing({ lat: 0, lng: 0 }, { lat: -1, lng: -1 })), '↙');
});
