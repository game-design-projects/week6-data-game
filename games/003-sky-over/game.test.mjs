import { test } from 'node:test';
import assert from 'node:assert/strict';
import game, { gmstDeg, altAz, project, makePuzzle, skyAt } from './game.js';
import { precess, moon, planets, sunAlt } from './astro.js';
import { makeRng, dailyIndex, addDays, isoFromDay, expScore, haversineKm } from '../../engine/core.js';
import data from './data.json' with { type: 'json' };

const slug = 'sky-over';
const realPuzzle = (day) => {
  const date = isoFromDay(day);
  return { date, p: game.puzzle({ data, day, date, slug, rng: makeRng(`${slug}:${date}`), pick: (arr) => arr[dailyIndex(slug, day, arr.length)] }) };
};

test('GMST at J2000 epoch', () => {
  assert.ok(Math.abs(gmstDeg(Date.UTC(2000, 0, 1, 12)) - 280.46) < 0.01);
});
test('Polaris altitude ≈ latitude (with precession)', () => {
  const pol = data.stars.find((s) => s[4] === 11767);
  const [ra, dec] = precess(pol[0], pol[1], 0.268);
  for (const lat of [20, 40.7, 60]) {
    const { alt } = altAz(ra, dec, lat, 123);
    assert.ok(Math.abs(alt - lat) < 1.2, `${lat} -> ${alt}`);
  }
});
test('zenith star and projection', () => {
  assert.ok(Math.abs(altAz(100, 30, 30, 100).alt - 90) < 1e-6);
  assert.deepEqual(project(0, 0).y, -1);
});
test('precession: ~50"/yr in RA near the equator', () => {
  const [ra] = precess(0, 0, 0.01); // one year
  assert.ok(Math.abs(ra - 46.1 / 3600) < 0.002, String(ra));
  const [r0, d0] = precess(123.4, -20, 0);
  assert.ok(Math.abs(r0 - 123.4) < 1e-9 && Math.abs(d0 + 20) < 1e-9);
});
test('moon phases match known new/full moons', () => {
  assert.ok(moon(Date.parse('2026-10-10T16:00:00Z')).elong < 8);
  assert.ok(moon(Date.parse('2026-10-26T04:00:00Z')).elong > 170);
  assert.ok(moon(Date.parse('2026-03-03T11:38:00Z')).elong > 175); // total lunar eclipse = full moon
});
test('planets: Sun at March equinox, Jupiter in Leo in Oct 2026', () => {
  const s = planets(Date.parse('2000-03-20T07:35:00Z')).Sun;
  assert.ok(Math.abs(s[0] < 180 ? s[0] : s[0] - 360) < 0.3 && Math.abs(s[1]) < 0.3);
  const j = planets(Date.parse('2026-10-15T00:00:00Z')).Jupiter;
  assert.ok(j[0] > 135 && j[0] < 175, `Jupiter RA ${j[0]}`);
});

test('longitude is recoverable from LST − GMST', () => {
  for (let day = 1; day <= 30; day++) {
    const { p } = realPuzzle(day);
    const s = skyAt(data, p);
    const lng = ((s.lst - s.gmst + 540) % 360) - 180;
    assert.ok(Math.abs(lng - p.city.lng) < 1e-6 || Math.abs(Math.abs(lng - p.city.lng) - 360) < 1e-6);
  }
});

test('pool: puzzles for days 1–120 are valid, distinct, dark', () => {
  const ids = new Set(), seenKey = new Set();
  for (let day = 1; day <= 120; day++) {
    const { date, p } = realPuzzle(day);
    const again = realPuzzle(day).p;
    assert.deepEqual(p, again, 'deterministic');
    const c = p.city;
    assert.ok(typeof c.name === 'string' && c.name.length > 1 && !/undefined|NaN/.test(c.name), c.name);
    assert.ok(c.country && !/undefined|NaN/.test(c.country), `${c.name} country`);
    assert.ok(Number.isFinite(c.lat) && Math.abs(c.lat) <= 66 && Number.isFinite(c.lng) && Math.abs(c.lng) <= 180, c.name);
    assert.ok(Number.isFinite(p.ms) && p.ms >= Date.parse(date) && p.ms < Date.parse(date) + 86400000 + 1, `${c.name} ms in the puzzle date`);
    assert.ok(sunAlt(p.ms, c.lat, c.lng) <= -12, `${date} ${c.name}: sun alt ${sunAlt(p.ms, c.lat, c.lng).toFixed(1)}`);
    assert.ok(p.solar >= 20.9 || p.solar <= 6, `solar ${p.solar}`);
    ids.add(`${c.name}|${c.country}`); seenKey.add(`${date}`);
    const s = skyAt(data, p);
    assert.ok(s.stars.filter((x) => x.alt > 0).length > 150, `${c.name}: enough stars above horizon`);
    for (const b of s.bodies) assert.ok(Number.isFinite(b.alt) && Number.isFinite(b.az), b.name);
    assert.ok(Number.isFinite(s.moon.alt) && s.moon.illum >= 0 && s.moon.illum <= 1);
  }
  assert.equal(ids.size, 120, 'no repeated city across 120 days');
});

test('city pool: unique names, no near-duplicate districts, sane fields', () => {
  assert.ok(data.cities.length >= 60);
  const keys = new Set();
  for (const c of data.cities) {
    assert.ok(!keys.has(`${c.name}|${c.country}`), `dup ${c.name}`);
    keys.add(`${c.name}|${c.country}`);
    assert.ok(c.pop >= 1e6 && c.country && c.name);
  }
  for (let i = 0; i < data.cities.length; i++) for (let j = i + 1; j < data.cities.length; j++)
    assert.ok(haversineKm(data.cities[i], data.cities[j]) >= 150, `${data.cities[i].name} ~ ${data.cities[j].name}`);
});

test('star data is well-formed', () => {
  for (const [ra, dec, mag, name, hip] of data.stars) {
    assert.ok(ra >= 0 && ra < 360 && dec >= -90 && dec <= 90 && mag <= 4.7 && Number.isInteger(hip) && typeof name === 'string');
  }
  assert.ok(data.stars.some((s) => s[4] === 11767));
  assert.ok(JSON.stringify(data).length < 1.5e6);
});

test('scoring extremes (pin, scale 1500 km)', () => {
  assert.equal(Math.round(expScore(0, 1500)), 100);
  assert.ok(expScore(300, 1500) > 80);   // good: lat from Polaris, longitude roughly
  assert.ok(expScore(1500, 1500) > 30 && expScore(1500, 1500) < 40);
  assert.ok(expScore(8000, 1500) < 1);    // wrong hemisphere / continent
});
