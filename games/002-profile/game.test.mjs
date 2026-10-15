import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { summarize, destPoint, lineEnds, angleDiff, scoreLine, explain, compassName } from './game.js';
import { makeRng, dailyIndex, haversineKm } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const slug = 'profile';
const mk = (day) => game.puzzle({ data, day, date: String(day), slug, rng: makeRng(`${slug}:${day}`), pick: (a) => a[dailyIndex(slug, day, a.length)] });

test('summarize', () => {
  assert.deepEqual(summarize([10, 50, 20]), { max: 50, min: 10, relief: 40, peakAt: 0.5 });
});

test('geometry: destPoint distance and bearing', () => {
  const a = { lat: 40, lng: -100 };
  for (const b of [0, 45, 90, 180, 270, 333]) {
    const q = destPoint(a, b, 120);
    assert.ok(Math.abs(haversineKm(a, q) - 120) < 0.5);
  }
  const e = lineEnds(a, 90, 240);
  assert.ok(Math.abs(haversineKm(e.a, e.b) - 240) < 0.5);
  assert.ok(e.b.lng > e.a.lng);
  assert.equal(angleDiff(350, 10), 20);
  assert.equal(angleDiff(0, 180), 180);
  assert.equal(compassName(90), 'E');
});

test('scoring extremes', () => {
  assert.equal(scoreLine(0, 0).total, 100);
  const typical = scoreLine(500, 30).total; // decent guess
  assert.ok(typical > 35 && typical < 65, typical);
  assert.ok(scoreLine(300, 0).total > scoreLine(300, 60).total);
  assert.ok(scoreLine(100, 0).total > scoreLine(600, 0).total);
  assert.equal(scoreLine(8000, 180).total, 0);
  assert.ok(scoreLine(2000, 90).total <= 3);
  // a flipped line (180° off) at the right place still earns only the position part
  assert.equal(scoreLine(0, 180).total, 70);
});

test('pool validity over days 1–120', () => {
  assert.ok(data.puzzles.length >= 60);
  assert.ok(JSON.stringify(data).length < 1.5e6);
  const ids = new Set(data.puzzles.map((p) => p.id));
  assert.equal(ids.size, data.puzzles.length);
  const places = new Set(data.puzzles.map((p) => p.place));
  assert.equal(places.size, data.puzzles.length);
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = mk(day);
    seen.add(p.id);
    assert.ok(data.regions[p.region], `region ${p.id}`);
    const reg = data.regions[p.region];
    assert.ok(reg.name && reg.bounds.length === 2);
    assert.ok(p.place && typeof p.place === 'string');
    assert.ok(Number.isFinite(p.lat) && Math.abs(p.lat) <= 85);
    assert.ok(Number.isFinite(p.lng) && Math.abs(p.lng) <= 180);
    // the transect must lie inside its region's map bounds
    const [[s, w], [n, e]] = reg.bounds;
    assert.ok(p.lat >= s && p.lat <= n && p.lng >= w && p.lng <= e, `${p.place} outside ${p.region} bounds`);
    assert.ok(Number.isInteger(p.bearing) && p.bearing >= 0 && p.bearing < 360 && p.bearing % 15 === 0);
    assert.equal(p.lenKm, 240);
    assert.equal(p.elev.length, 61);
    assert.ok(p.elev.every((v) => Number.isFinite(v) && v >= -500 && v <= 8900), `elev range ${p.id}`);
    const s2 = summarize(p.elev);
    assert.ok(s2.relief >= 250, `unguessably flat ${p.place}`);
    const ex = explain(p.elev, p.bearing, p.lenKm);
    assert.ok(ex.length >= 1 && ex.every((t) => t && !/undefined|NaN/.test(t)));
  }
  assert.ok(seen.size >= 60, `only ${seen.size} distinct in 120 days`);
});

test('no answer leak in anything shown before the guess', () => {
  // the pre-guess UI only uses region name, elevations and numbers; place names must not appear in them
  for (const p of data.puzzles) {
    for (const r of Object.values(data.regions)) assert.ok(!r.name.includes(p.place));
  }
  assert.ok(!/place name/.test(game.meta.title));
  const bearings = new Set(data.puzzles.map((p) => p.bearing));
  assert.ok(bearings.size >= 12, 'bearings should vary');
});

test('meta', () => {
  assert.ok(game.meta.sources.length && game.meta.sources.every((s) => /^https:\/\//.test(s.url)));
  assert.ok(game.meta.howTo.length >= 2);
});
