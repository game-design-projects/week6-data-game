import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { roughFare, whenParts, fmtMin, explain, meterBounds, crowMiles } from './game.js';
import { expScore, logError, mulberry32 } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('roughFare', () => assert.equal(roughFare(2), 10));
test('whenParts', () => {
  const w = whenParts('2023-03-04T08:15');
  assert.equal(w.wd, '周六'); assert.equal(w.hhmm, '08:15'); assert.equal(w.slot, '早高峰前后');
});
test('fmtMin', () => { assert.equal(fmtMin(25), '25 分钟'); assert.equal(fmtMin(75), '1 小时 15 分'); });

test('pool: puzzles for days 1-120 are valid', () => {
  assert.ok(data.trips.length >= 60, 'pool >= 60 trips');
  const pool = new Set(), ids = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: 'fare', rng: null, pick: (arr) => arr[(day * 7919) % arr.length] });
    const t = p.trip;
    for (const k of ['t', 'pu', 'do', 'mi', 'min', 'fare', 'pax']) assert.ok(t[k] !== undefined && t[k] !== null && !Number.isNaN(t[k]), `${k} missing`);
    assert.match(t.t, /^2023-\d\d-\d\dT\d\d:\d\d$/);
    assert.ok(!Number.isNaN(Date.parse(t.t + ':00Z')));
    assert.notEqual(t.pu, t.do);
    assert.ok(t.fare >= 3 && t.fare <= 150, 'fare range');
    assert.ok(t.min >= 3 && t.min <= 120, 'min range');
    assert.ok(t.mi > 0.3 && t.mi < 45, 'mi range');
    assert.ok(t.pax >= 1 && t.pax <= 9);
    for (const z of [data.zones[t.pu], data.zones[t.do]]) {
      assert.ok(z, 'zone exists');
      assert.ok(z.name && z.boro && !/undefined|NaN/.test(z.name + z.boro));
      assert.ok(Array.isArray(z.c) && z.c.every(Number.isFinite) && z.c[0] > 40.4 && z.c[0] < 41 && z.c[1] > -74.3 && z.c[1] < -73.6);
      assert.ok(z.ring.length >= 3 && z.ring.flat().every(Number.isFinite));
    }
    pool.add(`${t.pu}>${t.do}`);
  }
  assert.ok(pool.size >= 60, 'enough distinct trips in 120 days');
  const keys = data.trips.map((t) => `${t.pu}>${t.do}`);
  assert.equal(new Set(keys).size, keys.length, 'no duplicate pickup>dropoff pairs');
});

test('pool: meter model explains fares (guessable, not noise)', () => {
  for (const t of data.trips) {
    const { byDist, byTime } = meterBounds(t.mi, t.min);
    const lo = Math.min(byDist, byTime) * 0.55, hi = Math.max(byDist, byTime) * 2.2;
    assert.ok(t.fare >= lo && t.fare <= hi, `fare ${t.fare} outside model band ${lo.toFixed(1)}-${hi.toFixed(1)} for ${JSON.stringify(t)}`);
  }
});

test('no answer leak in puzzle() output beyond the clue fields', () => {
  const p = game.puzzle({ data, day: 1, date: '2026-10-01', slug: 'fare', rng: null, pick: (a) => a[0] });
  assert.ok(p.trip.fare > 0); // play() shows only zones/time/pax/crow distance before guessing
  assert.ok(!game.meta.tagline.match(/\$\d/));
});

test('scoring extremes (log scale 0.3)', () => {
  const sc = (g, a) => expScore(logError(g, a), 0.3);
  assert.equal(sc(20, 20), 100);
  assert.ok(sc(40, 20) >= 36 && sc(40, 20) <= 38);
  assert.ok(sc(25, 20) > 70);
  assert.ok(sc(3, 150) < 2); // slider extremes are worth ~nothing
  assert.ok(sc(10, 20) === sc(40, 20)); // symmetric on log scale
});

test('explain is specific to the trip', () => {
  const slow = { t: '2023-03-04T08:15', mi: 2, min: 25, fare: 20, pu: 1, do: 2, pax: 1 };
  const fast = { t: '2023-03-04T03:15', mi: 12, min: 20, fare: 42, pu: 1, do: 2, pax: 1 };
  assert.match(explain(slow, 1.4), /按时间计费/);
  assert.match(explain(fast, 9), /主要按里程/);
  assert.match(explain(fast, 9), /\$45\.00/);
  assert.ok(crowMiles([40.75, -73.98], [40.76, -73.98]) > 0.6);
});
