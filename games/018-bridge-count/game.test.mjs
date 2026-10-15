import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { weatherLabel, total, shapeDays, pickLive, isFair, buildTypical, typicalFor, explainDay, BRIDGES, EST_MIN, EST_MAX, MIN_GAP } from './game.js';
import { makeRng, dayNumber, isoFromDay, addDays, expScore, logError } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const fx = JSON.parse(readFileSync(new URL('./build/fixture.json', import.meta.url)));

test('weatherLabel', () => {
  assert.equal(weatherLabel(0), '晴天');
  assert.equal(weatherLabel(3), '阴天');
  assert.equal(weatherLabel(63, 0, 0.8), '大雨');
  assert.equal(weatherLabel(73, 1), '下雪');
  assert.equal(weatherLabel(95), '雷暴');
});
test('total', () => assert.equal(total([1, 2, 3]), 6));

test('shapeDays keeps only complete days and rebuilds the day record from the fixture', () => {
  const days = shapeDays(fx.rows, fx.weather.daily);
  assert.ok(days.length >= 3 && days.length < 13, `${days.length} days`);
  for (const d of days) {
    assert.equal(d.c.length, 4);
    assert.ok(d.c.every(Number.isInteger));
    assert.match(d.date, /^\d{4}-\d\d-\d\d$/);
  }
  // an incomplete sensor-day (k off) must drop the whole day
  const r = fx.rows.map((x) => ({ ...x }));
  const victim = r.find((x) => x.sensor_id === '100062893' && x.d.startsWith(days[0].date));
  victim.k = '10';
  assert.ok(!shapeDays(r, fx.weather.daily).some((d) => d.date === days[0].date));
  assert.deepEqual(shapeDays([], fx.weather.daily), []);
  assert.deepEqual(shapeDays(fx.rows, null), []);
});

test('pickLive anchors to the puzzle date with a lag and is stable', () => {
  const days = shapeDays(fx.rows, fx.weather.daily);
  const fair = days.filter(isFair);
  const date = addDays(days.at(-1).date, 2);
  const p = pickLive(days, date);
  assert.ok(p);
  assert.ok(p.date <= addDays(date, -2));
  assert.deepEqual(p, pickLive(days, date));
  assert.equal(pickLive(days, '2030-01-01'), null); // nothing within the window
  assert.ok(fair.length >= 1);
});

test('isFair rejects dead sensors and near ties', () => {
  assert.equal(isFair({ c: [5000, 4000, 3000, 2000] }), true);
  assert.equal(isFair({ c: [5000, 4990, 3000, 2000] }), false);
  assert.equal(isFair({ c: [5000, 4000, 3000, 50] }), false);
  assert.equal(isFair({ c: [5000, 4000, NaN, 2000] }), false);
});

test('pool: 120 days of puzzles are all valid', () => {
  assert.ok(data.days.length >= 60);
  assert.ok(JSON.stringify(data).length < 1.5e6);
  const dates = new Set(data.days.map((d) => d.date));
  assert.equal(dates.size, data.days.length, 'duplicate dates');
  const seen = new Set();
  for (let n = 1; n <= 120; n++) {
    const date = isoFromDay(n);
    const rng = makeRng(`bridge-count:${date}`);
    const p = game.puzzle({ data, day: n, date, slug: 'bridge-count', rng, pick: (arr) => arr[(n * 7919) % arr.length] });
    seen.add(p.date);
    assert.match(p.date, /^\d{4}-\d\d-\d\d$/);
    assert.equal(p.c.length, 4);
    for (const v of p.c) assert.ok(Number.isInteger(v) && v >= 100 && v < 40000, `${p.date} count ${v}`);
    for (const k of ['hi', 'lo', 'rain', 'snow', 'wind', 'wc']) assert.ok(Number.isFinite(p[k]), `${p.date} ${k}`);
    assert.ok(p.lo <= p.hi && p.hi > -10 && p.hi < 110 && p.wind >= 0 && p.wind < 80 && p.rain >= 0 && p.rain < 10);
    assert.ok(isFair(p));
    const t = typicalFor(data.typical, p.date);
    assert.equal(t.length, 4);
    assert.ok(t.every((v) => Number.isFinite(v) && v > 100));
    const s = total(p.c);
    assert.ok(s > EST_MIN * 1.5 && s < EST_MAX * 0.8, 'estimate range');
    const lines = explainDay(p, t);
    assert.ok(lines.length >= 2 && lines.every((l) => !/undefined|NaN/.test(l)));
  }
  assert.ok(seen.size >= 100);
});

test('every pool day is a real, ranked, tie-free day (no NaN anywhere)', () => {
  for (const d of data.days) {
    const s = [...d.c].sort((a, b) => b - a);
    for (let i = 1; i < 4; i++) assert.ok(s[i - 1] / s[i] >= MIN_GAP, d.date);
  }
  assert.equal(data.typical.length, 12);
  for (const m of data.typical) for (const w of m) { assert.equal(w.length, 4); w.forEach((v) => assert.ok(v > 0)); }
});

test('no answer leak in static copy', () => {
  const m = game.meta;
  assert.ok(m.howTo.length >= 2);
  assert.ok(BRIDGES.length === 4);
  assert.equal(m.data, 'live');
});

test('scoring extremes: perfect ~ max, typical decent, worst near zero', () => {
  const ans = 20000;
  assert.equal(expScore(logError(ans, ans), 0.2), 100);
  const typ = expScore(logError(ans * 1.15, ans), 0.2);
  assert.ok(typ > 40 && typ < 80, `typ ${typ}`);
  assert.ok(expScore(logError(EST_MIN, EST_MAX), 0.2) < 1);
  // lazily guessing "a typical day's total" is decent on average but clearly beatable, and poor on wet days
  const sc = (x) => expScore(logError(total(typicalFor(data.typical, x.date)), total(x.c)), 0.2);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(mean(data.days.map(sc)) < 72);
  assert.ok(mean(data.days.filter((x) => x.rain > 0.5).map(sc)) < 50);
});

test('buildTypical medians', () => {
  const days = [{ date: '2026-03-02', c: [1, 2, 3, 4] }, { date: '2026-03-03', c: [3, 4, 5, 6] }, { date: '2026-03-07', c: [9, 9, 9, 9] }];
  const t = buildTypical(days);
  assert.deepEqual(t[2][0], [2, 3, 4, 5]);
  assert.deepEqual(t[2][1], [9, 9, 9, 9]);
});
