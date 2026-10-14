import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { subPoint, groundTrack, latBucket, periodBucket, classify } from './orbit.mjs';
const iss = { EPOCH: '2026-10-13T19:43:00', MEAN_MOTION: 15.5, ECCENTRICITY: 0.0005, INCLINATION: 51.6, RA_OF_ASC_NODE: 100, ARG_OF_PERICENTER: 90, MEAN_ANOMALY: 0 };
test('max latitude equals inclination', () => {
  const t = groundTrack(iss, 12);
  assert.ok(Math.abs(t.maxLat - 51.6) < 1.5);
  assert.ok(Math.abs(subPoint(iss, 0).lat) <= 51.7);
});
test('geo is stationary', () => {
  const g = { ...iss, MEAN_MOTION: 1.0027, INCLINATION: 0.05, ECCENTRICITY: 0.0002 };
  assert.ok(groundTrack(g, 12).maxLat < 1);
  assert.equal(classify(g), 'geo');
});
test('buckets', () => {
  assert.equal(latBucket(51.6), 2); assert.equal(latBucket(82), 4);
  assert.equal(periodBucket(92), 0); assert.equal(periodBucket(717), 3); assert.equal(periodBucket(1436), 4);
});
test('data classes agree with buckets', () => {
  const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
  assert.ok(d.sats.length >= 60);
  for (const s of d.sats) if (s.cls === 'sso') assert.equal(latBucket(s.maxLat), 4);
});
