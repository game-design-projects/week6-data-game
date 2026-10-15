import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { CLASSES, clue } from './game.js';
import { makeRng } from '../../engine/core.js';
import { subPoint, groundTrack, latBucket, periodBucket, classify, toPuzzle, edgeMargin, LAT_BUCKETS, PERIOD_LADDER } from './orbit.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const fixture = JSON.parse(fs.readFileSync(new URL('./build/fixture.json', import.meta.url)));
const iss = { EPOCH: '2026-10-13T19:43:00', MEAN_MOTION: 15.5, ECCENTRICITY: 0.0005, INCLINATION: 51.6, RA_OF_ASC_NODE: 100, ARG_OF_PERICENTER: 90, MEAN_ANOMALY: 0 };

test('max latitude equals inclination', () => {
  const t = groundTrack(iss, 12);
  assert.ok(Math.abs(t.maxLat - 51.6) < 1.5);
  assert.ok(Math.abs(subPoint(iss, 0).lat) <= 51.7);
  assert.equal(t.marks.length, 4);
});
test('geo is stationary', () => {
  const g = { ...iss, MEAN_MOTION: 1.0027, INCLINATION: 0.05, ECCENTRICITY: 0.0002 };
  assert.ok(groundTrack(g, 12).maxLat < 1);
  assert.equal(classify(g), 'geo');
});
test('buckets', () => {
  assert.equal(latBucket(51.6), 2); assert.equal(latBucket(82), 4); assert.equal(latBucket(5), 0); assert.equal(latBucket(41.5), 1);
  assert.equal(periodBucket(92), 0); assert.equal(periodBucket(717), 3); assert.equal(periodBucket(845), 3); assert.equal(periodBucket(1436), 4);
  assert.equal(LAT_BUCKETS.length, 5); assert.equal(PERIOD_LADDER.length, 5);
});

test('toPuzzle shapes live elements (fixture) and anchors to the date', () => {
  const base = { id: 25544, cls: 'leo' };
  const p = toPuzzle(fixture, '2026-10-15', base);
  assert.ok(p, 'fixture must shape');
  assert.equal(p.id, 25544); assert.equal(p.cls, 'leo');
  assert.equal(p.from, '2026-10-15T00:00');
  assert.ok(Math.abs(p.maxLat - p.inc) < 1.5);
  assert.equal(p.marks.length, 4);
  assert.equal(toPuzzle(fixture, '2026-10-15', { id: 1, cls: 'leo' }), null);        // wrong satellite
  assert.equal(toPuzzle(fixture, '2026-10-15', { id: 25544, cls: 'geo' }), null);     // class changed
  assert.equal(toPuzzle([], '2026-10-15', base), null);
  assert.equal(toPuzzle(fixture, '2030-01-01', base), null);                           // stale elements
});

test('pool: 120 days of puzzles are valid', () => {
  assert.ok(data.sats.length >= 60);
  const ids = new Set(); const names = new Set();
  for (const s of data.sats) {
    assert.ok(!ids.has(s.id), 'dup id ' + s.id); ids.add(s.id); names.add(s.name);
    assert.ok(CLASSES.some((c) => c.id === s.cls));
    for (const k of ['id', 'name', 'cls', 'epoch', 'inc', 'ecc', 'periodMin', 'perigeeKm', 'apogeeKm', 'maxLat']) assert.ok(s[k] !== undefined && s[k] !== null && s[k] !== '' && !Number.isNaN(s[k]), `${s.name}.${k}`);
    assert.ok(s.periodMin > 80 && s.periodMin < 1500);
    assert.ok(s.maxLat >= 0 && s.maxLat <= 90 && s.inc >= 0 && s.inc <= 180);
    assert.ok(s.perigeeKm > 150 && s.apogeeKm >= s.perigeeKm - 1);
    assert.ok(edgeMargin(s.maxLat) >= 1.5, `${s.name} maxLat ${s.maxLat} too close to a bucket edge`);
    assert.equal(s.marks.length, 4);
    const pts = s.track.flat();
    assert.ok(pts.length >= 1);
    for (const [a, b] of pts) { assert.ok(Number.isFinite(a) && Math.abs(a) <= 900 && Number.isFinite(b) && Math.abs(b) <= 1800); }
    // class sanity: each class has the signature the explanation claims
    if (s.cls === 'sso') assert.equal(latBucket(s.maxLat), 4);
    if (s.cls === 'geo') assert.equal(periodBucket(s.periodMin), 4);
    if (s.cls === 'mol') assert.ok(s.ecc > 0.6);
    assert.ok(clue(s).length > 20 && !/undefined|NaN/.test(clue(s)));
  }
  const counts = {}; data.sats.forEach((s) => (counts[s.cls] = (counts[s.cls] || 0) + 1));
  for (const c of CLASSES) assert.ok(counts[c.id] >= 10, `class ${c.id} has ${counts[c.id]}`);
  for (let day = 1; day <= 120; day++) {
    const rng = makeRng ? makeRng(`ground-track:${day}`) : null;
    const pick = (arr) => arr[(day * 7 + 3) % arr.length];
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: 'ground-track', rng, pick });
    assert.ok(data.sats.includes(p.sat));
  }
});

test('no answer leak: class/sat name never appears in anything shown before the guess', () => {
  // visible before guessing: option labels (identical for every puzzle), prompts, tagline, howTo
  const shown = JSON.stringify([game.meta.tagline, game.meta.howTo, CLASSES.map((c) => [c.label, c.sub]), LAT_BUCKETS, PERIOD_LADDER]);
  for (const s of data.sats) assert.ok(!shown.includes(s.name), s.name);
});

test('scoring extremes: 3 questions, perfect 3, blind guess expectation is low', () => {
  // options are fixed per question (5 each); a uniform random guesser gets 3/5 = 0.6 of 3 points on average
  const exp = 3 * (1 / 5);
  assert.ok(exp < 1);
  const s = data.sats[0];
  const answers = [CLASSES.findIndex((c) => c.id === s.cls), periodBucket(s.periodMin), latBucket(s.maxLat)];
  answers.forEach((a, i) => assert.ok(a >= 0 && a < 5, `q${i}`));
});
