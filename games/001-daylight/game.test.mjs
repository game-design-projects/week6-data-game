import { test } from 'node:test';
import assert from 'node:assert/strict';
import game, { sunUTC, clockHours } from './game.js';

const fmt = (tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });

test('New York solstice sunrise/sunset within 5 minutes of NOAA', () => {
  const s = sunUTC('2026-06-21', 40.7128, -74.006);
  const f = fmt('America/New_York');
  assert.ok(Math.abs(clockHours(s.rise, f) - (5 + 25 / 60)) < 5 / 60, `rise ${clockHours(s.rise, f)}`);
  assert.ok(Math.abs(clockHours(s.set, f) - (20 + 31 / 60)) < 5 / 60, `set ${clockHours(s.set, f)}`);
});

test('polar night returns null rise/set', () => {
  const s = sunUTC('2026-12-21', 78.22, 15.65); // Longyearbyen
  assert.equal(s.rise, null);
});

test('puzzle builds a full year with a DST jump for a DST city', () => {
  const data = { cities: [{ name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, tz: 'Europe/Berlin', pop: 3e6 }] };
  const p = game.puzzle({ data, date: '2026-10-14', pick: (a) => a[0] });
  assert.equal(p.days.length, 365);
  const jumps = p.days.filter((d, i) => i && Math.abs(d.noon - p.days[i - 1].noon) > 0.5);
  assert.equal(jumps.length, 2);
});

import { readFileSync } from 'node:fs';
import { explain, hhmm, dstJumps, stdOffsetHours } from './game.js';
import { haversineKm } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const DATE = (day) => new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);

test('pool: every city is well-formed and unique', () => {
  assert.ok(data.cities.length >= 60);
  const seen = new Set();
  for (const c of data.cities) {
    for (const k of ['name', 'country', 'cc', 'tz']) assert.ok(typeof c[k] === 'string' && c[k].length, `${c.name} ${k}`);
    assert.ok(Number.isFinite(c.lat) && Math.abs(c.lat) <= 90 && Number.isFinite(c.lng) && Math.abs(c.lng) <= 180);
    assert.ok(c.pop >= 100000);
    assert.doesNotThrow(() => fmt(c.tz));
    assert.ok(!seen.has(c.name + c.cc), `dup ${c.name}`);
    seen.add(c.name + c.cc);
  }
});

test('puzzles for days 1–120 are complete, sane and leak-free', () => {
  const ids = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = DATE(day);
    const used = new Set();
    const p = game.puzzle({ data, date, day, pick: (a) => a[(day * 7) % a.length] });
    assert.ok(data.cities.includes(p.city));
    assert.ok(p.days.length === 365 || p.days.length === 366);
    for (const d of p.days) {
      assert.match(d.iso, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(!used.has(d.iso)); used.add(d.iso);
      assert.ok(Number.isFinite(d.noon) && d.noon >= 0 && d.noon < 24);
      if (d.rise != null) {
        assert.ok(d.rise >= 0 && d.rise < 24 && d.set > d.rise && d.set - d.rise < 24, `${p.city.name} ${d.iso} ${d.rise} ${d.set}`);
        assert.ok(d.set <= 30);
      }
    }
    // the visible payload must not contain the answer: only numbers and ISO dates
    const visible = JSON.stringify(p.days);
    assert.ok(!visible.includes(p.city.name));
    ids.add(p.city.name);
  }
  assert.ok(ids.size > 30);
});

test('every city in the pool yields a full non-polar curve', () => {
  for (const c of data.cities) {
    const p = game.puzzle({ data, date: '2026-10-15', pick: () => c });
    assert.ok(p.days.every((d) => d.rise != null && d.set > d.rise), c.name);
    const j = dstJumps(p.days);
    assert.ok(j.length === 0 || j.length === 2, `${c.name} ${j}`);
  }
});

test('Reykjavik summer sunsets wrap past 24:00 without negative day length', () => {
  const c = data.cities.find((x) => x.name === 'Reykjavik');
  const p = game.puzzle({ data, date: '2026-10-15', pick: () => c });
  assert.ok(Math.max(...p.days.map((d) => d.set)) > 24);
});

test('hhmm never prints 60 minutes', () => {
  assert.equal(hhmm(11.9999), '12:00');
  assert.equal(hhmm(25.5), '01:30');
  assert.equal(hhmm(6.5), '06:30');
});

test('explain: Berlin is north, UTC+1, west of its meridian, DST in March/October', () => {
  const c = { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, tz: 'Europe/Berlin', pop: 3e6 };
  const p = game.puzzle({ data: { cities: [c] }, date: '2026-10-15', pick: (a) => a[0] });
  const f = fmt(c.tz);
  assert.equal(stdOffsetHours(2026, f), 1);
  const ex = explain(c, p.days, 2026, f);
  assert.match(ex.lat, /北半球/);
  assert.match(ex.lng, /UTC\+1/);
  assert.match(ex.lng, /偏西/);
  assert.deepEqual(ex.jumps, ['03-29', '10-25']);
});

test('explain: Sydney is south; Singapore has no DST and tiny amplitude', () => {
  const syd = { name: 'Sydney', country: 'Australia', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' };
  const sg = { name: 'Singapore', country: 'Singapore', lat: 1.29, lng: 103.85, tz: 'Asia/Singapore' };
  const ps = game.puzzle({ data: { cities: [syd] }, date: '2026-10-15', pick: (a) => a[0] });
  assert.match(explain(syd, ps.days, 2026, fmt(syd.tz)).lat, /南半球/);
  const pg = game.puzzle({ data: { cities: [sg] }, date: '2026-10-15', pick: (a) => a[0] });
  const e = explain(sg, pg.days, 2026, fmt(sg.tz));
  assert.match(e.lat, /赤道/);
  assert.match(e.dst, /不实行/);
});

test('scoring extremes: exact = 100, 1500 km ≈ 37, antipode ≈ 0', () => {
  const score = (km) => 100 * Math.exp(-km / 1500);
  assert.equal(score(0), 100);
  assert.ok(Math.abs(score(1500) - 36.8) < 0.5);
  assert.ok(score(20000) < 0.1);
  // a "right hemisphere and zone" guess ~ 1000 km off still earns a decent score
  assert.ok(score(1000) > 50);
  assert.ok(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 }) > 19000);
});
