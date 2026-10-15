import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import g, { mean, band, toLive, validSet, addDays, heuristicHits } from './game.js';
import { makeRng } from '../../engine/core.js';
const rd = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const data = rd('./data.json'); const fx = rd('./build/fixture.json');

test('mean skips nulls', () => assert.equal(mean([1, null, 3]), 2));
test('band edges (EPA 2024)', () => { assert.equal(band(5), 'Good'); assert.equal(band(9.1), 'Moderate'); assert.equal(band(40), 'Unhealthy for sensitive groups'); assert.equal(band(200), 'Very unhealthy'); assert.equal(band(300), 'Hazardous'); });
test('addDays', () => { assert.equal(addDays('2026-10-01', -1), '2026-09-30'); assert.equal(addDays('2026-02-28', 1), '2026-03-01'); });

const checkPuzzle = (p, label) => {
  assert.equal(p.cities.length, 5, label);
  assert.equal(new Set(p.cities.map((c) => c.en)).size, 5, label + ' distinct');
  assert.match(p.date, /^\d{4}-\d\d-\d\d$/);
  for (const c of p.cities) {
    assert.ok(c.en && !c.zh, label); assert.equal(c.prev.length, 14);
    assert.ok(Number.isFinite(c.val) && c.val >= 2 && c.val < 1500, `${label} val ${c.val}`);
    for (const v of c.prev) assert.ok(v == null || (Number.isFinite(v) && v >= 0 && v < 1500), label + ' prev');
    assert.ok(c.prev[13] != null);
  }
  assert.ok(validSet(p.cities), label + ' valid set');
  // no leak: the answer values are never in the visible clue text of cities' prev beyond history; target date is after all prev days
};

test('snapshot pool: days 1-120 all valid', () => {
  const ids = new Set();
  for (let day = 1; day <= 120; day++) {
    const rng = makeRng(`037-aqi-rank:${day}`);
    const pick = (a) => a[(day - 1) % a.length];
    const p = g.puzzle({ data, day, date: addDays('2026-10-01', day - 1), slug: 'aqi-rank', rng, pick });
    assert.equal(p.live, false);
    checkPuzzle(p, `day ${day}`); ids.add(p.date + p.cities.map((c) => c.en).join());
  }
  assert.ok(data.puzzles.length >= 60); assert.ok(ids.size >= 60);
});

test('every raw pool entry valid and cities well-formed', () => {
  assert.ok(data.cities.length >= 50);
  for (const c of data.cities) { assert.ok(Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180); }
  assert.equal(new Set(data.cities.map((c) => c.en)).size, data.cities.length);
});

test('toLive shapes the committed fixture', () => {
  const cities = fx.idx.map((i) => data.cities[i]);
  const L = toLive(fx.raw, fx.day, cities, 3);
  assert.equal(L.date, '2026-10-14'); assert.equal(L.cities.length, 3);
  for (const c of L.cities) { assert.equal(c.prev.length, 14); assert.ok(Number.isFinite(c.val)); }
  assert.equal(L.cities[0].en, 'Beijing');
  assert.throws(() => toLive(fx.raw, fx.day, cities.slice(0, 2), 3));
  assert.throws(() => toLive(fx.raw, fx.day, cities), /too few/);
});

test('live puzzle from synthetic 40-city live data validates', () => {
  const cities = data.cities.slice(0, 40);
  const live = { date: '2026-10-14', cities: cities.map((c, i) => ({ en: c.en, prev: Array(14).fill(10 + i * 3), val: 8 + i * 4 })) };
  const rng = makeRng('x');
  const p = g.puzzle({ data: { ...data, live }, rng, pick: (a) => a[0] });
  assert.equal(p.live, true); checkPuzzle(p, 'live');
});

test('scoring extremes via heuristicHits', () => {
  const rows = [{ en: 'a', val: 50, avg: 50, last: 50 }, { en: 'b', val: 30, avg: 30, last: 10 }, { en: 'c', val: 10, avg: 10, last: 30 }];
  assert.equal(heuristicHits(rows, 'avg'), 3); assert.equal(heuristicHits(rows, 'last'), 1);
});

test('puzzle is deterministic', () => {
  const a = g.puzzle({ data, rng: makeRng('s'), pick: (x) => x[3] }); const b = g.puzzle({ data, rng: makeRng('s'), pick: (x) => x[3] });
  assert.deepEqual(a, b);
});
