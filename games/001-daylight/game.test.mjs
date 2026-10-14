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
