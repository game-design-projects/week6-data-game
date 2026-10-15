import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { summarize, yearsWithWeekday, regionOf } from './game.js';
import { dailyIndex } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('summarize counts cities and types', () => {
  const s = summarize([
    ['2020-01-01', 40, -74, 'NYC', 'MSG', 'Indoor arena'],
    ['2020-01-02', 40, -74, 'NYC', 'MSG', 'Indoor arena'],
    ['2020-01-10', 51.5, 0, 'London', 'O2', 'Arena'],
  ]);
  assert.equal(s.n, 3);
  assert.equal(s.cities, 2);
  assert.deepEqual(s.top[0], ['NYC', 2]);
  assert.equal(s.spanDays, 9);
  assert.ok(s.km > 5000 && s.km < 6000);
  assert.deepEqual(s.regions, [['北美洲', 2], ['欧洲', 1]]);
});

test('yearsWithWeekday', () => {
  const ys = yearsWithWeekday('05-10', 3); // 2017-05-10 was a Wednesday
  assert.ok(ys.includes(2017));
  assert.ok(!ys.includes(2018));
});

test('regionOf', () => {
  assert.equal(regionOf(40.7, -74), '北美洲');
  assert.equal(regionOf(-23.5, -46.6), '南美洲');
  assert.equal(regionOf(51.5, 0), '欧洲');
  assert.equal(regionOf(35.7, 139.7), '亚洲');
  assert.equal(regionOf(-33.9, 151.2), '大洋洲');
  assert.equal(regionOf(-26.2, 28), '非洲');
  assert.equal(regionOf(25.2, 55.3), '亚洲');
});

test('pool: every puzzle over days 1-120 is valid', () => {
  const artists = new Map(data.artists.map((a) => [a.id, a]));
  assert.ok(data.tours.length >= 60, 'pool size');
  assert.equal(new Set(data.tours.map((t) => t.id)).size, data.tours.length, 'duplicate tour ids');
  assert.equal(new Set(data.artists.map((a) => a.id)).size, data.artists.length);
  assert.equal(new Set(data.artists.map((a) => a.name)).size, data.artists.length, 'ambiguous option labels');
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const pick = (arr) => arr[dailyIndex('tour-map', day, arr.length)];
    const rng = undefined;
    const p = game.puzzle({ data, day, date, slug: 'tour-map', rng, pick });
    const tour = data.tours.find((t) => t.id === p.id);
    assert.ok(tour, `day ${day}: tour exists`);
    seen.add(p.id);
    const a = artists.get(tour.artist);
    assert.ok(a?.name && a.country, `day ${day}: artist with name and country`);
    assert.ok(tour.tour && tour.tour.trim(), 'tour name');
    assert.ok(tour.stops.length >= 8, 'stops');
    assert.equal(tour.year, +tour.stops[0][0].slice(0, 4), 'year = first stop year');
    assert.ok(tour.year >= 1965 && tour.year <= 2026);
    const cand = yearsWithWeekday(tour.stops[0][0].slice(5), new Date(`${tour.stops[0][0]}T12:00:00Z`).getUTCDay());
    assert.ok(cand.includes(tour.year), 'answer year is among weekday candidates');
    assert.ok(cand.length >= 3 && cand.length <= 14, `candidate count ${cand.length}`);
    let prev = '';
    const keys = new Set();
    for (const s of tour.stops) {
      const [d, lat, lng, city, venue, ptype] = s;
      assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(!Number.isNaN(Date.parse(d)));
      assert.ok(d >= prev, 'stops sorted by date'); prev = d;
      assert.ok(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
      assert.ok(!(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01), 'null island');
      assert.ok(venue && venue.trim(), 'venue');
      assert.equal(typeof city, 'string'); assert.equal(typeof ptype, 'string');
      keys.add(d + venue);
    }
    assert.equal(keys.size, tour.stops.length, 'duplicate stop');
    const sum = summarize(tour.stops);
    assert.ok(sum.km > 0 && Number.isFinite(sum.km) && sum.spanDays <= 1500);
    // answer leaks: artist name must not appear in any visible clue text (cities, venues)
    const nm = a.name.toLowerCase();
    if (nm.length >= 5) {
      const hay = tour.stops.map((s) => `${s[3]} ${s[4]}`).join(' | ').toLowerCase();
      assert.ok(!new RegExp(`\\b${nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay), `day ${day}: artist name appears in venue/city text`);
    }
  }
  assert.equal(seen.size, Math.min(120, data.tours.length));
});

test('every tour has a distinctive hidden name (tour name not shown pre-guess)', () => {
  // the tour title may contain the artist or year; it is only used in the result detail
  const src = fs.readFileSync(new URL('./game.js', import.meta.url), 'utf8');
  const play = src.slice(src.indexOf('async play'));
  const before = play.slice(0, play.indexOf('const res = ctx.combine'));
  assert.ok(!/tour\.tour/.test(before.replace(/ctx\.log\([^)]*\)/g, '')), 'tour.tour used before the result');
});
