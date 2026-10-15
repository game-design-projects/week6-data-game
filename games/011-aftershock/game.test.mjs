import test from 'node:test';
import assert from 'node:assert/strict';
import g, { magScore, nearby, toPuzzle } from './game.js';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const fixture = JSON.parse(fs.readFileSync(new URL('./build/fixture.json', import.meta.url)));

test('magScore extremes', () => {
  assert.equal(magScore(6, 6), 100);
  assert.ok(magScore(6.6, 6) < 40 && magScore(6.6, 6) > 35);
  assert.ok(magScore(9.5, 4.8) < 1);
  assert.ok(magScore(6, 6.3) > 55);
});
test('nearby', () => {
  assert.equal(nearby([[0, 0, 3], [50, 50, 3]], 0, 0, 100, (a, b, c, d) => Math.hypot(a - c, b - d) * 100).length, 1);
});
test('toPuzzle shapes the fixture', () => {
  const t = fixture.features[0];
  const p = toPuzzle(fixture, new Date(t.properties.time).toISOString().slice(0, 10));
  assert.ok(p);
  assert.equal(p.top.mag, t.properties.mag);
  assert.equal(p.others.length, p.n - 1);
  assert.ok(p.others[0][2] <= p.others[1]?.[2] + 1e-9 || p.others[0][2] >= p.others[1][2]);
  assert.ok(!p.others.some((o) => o[2] == null));
  assert.equal(toPuzzle(fixture, '1999-01-01'), null);
  assert.equal(toPuzzle({ features: [] }, '2026-01-01'), null);
});
test('toPuzzle rejects days without a clear biggest quake', () => {
  const mk = (mags) => ({ features: mags.map((m, i) => ({ id: 'a' + i, properties: { mag: m, type: 'earthquake', time: Date.parse('2026-05-01T10:00:00Z') + i }, geometry: { coordinates: [i, i % 80] } })) });
  const many = (top, second) => [top, second, ...Array(45).fill(3)];
  assert.ok(toPuzzle(mk(many(5.5, 4.0)), '2026-05-01'));
  assert.equal(toPuzzle(mk(many(5.5, 5.4)), '2026-05-01'), null);
  assert.equal(toPuzzle(mk(many(4.5, 3.5)), '2026-05-01'), null);
  assert.equal(toPuzzle(mk([6, 5, 3]), '2026-05-01'), null);
});

const URLRE = /^https?:\/\/\S+$/;
test('pool validity over days 1-120', () => {
  const dates = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.parse('2026-10-01') + (day - 1) * 864e5).toISOString().slice(0, 10);
    const p = g.puzzle({ data, day, date, slug: 'aftershock', rng: null, pick: (arr) => arr[(day * 7) % arr.length] });
    dates.add(p.date);
    assert.ok(p.top.mag >= 4.8 && p.top.mag <= 9.9 && p.top.mag - p.others[0][2] >= 0.2, p.date);
    assert.ok(Math.abs(p.top.lat) <= 90 && Math.abs(p.top.lng) <= 180);
    assert.ok(p.top.place && !/undefined|NaN/.test(p.top.place), p.date);
    assert.ok(p.others.length === p.n - 1 && p.n >= 25);
  }
  assert.ok(dates.size >= 50);
  const ids = new Set();
  for (const p of data.puzzles) {
    assert.ok(!ids.has(p.date)); ids.add(p.date);
    assert.match(p.date, /^\d{4}-\d\d-\d\d$/);
    assert.match(p.top.time, /^\d\d:\d\d$/);
    for (const o of p.others) assert.ok(o.length === 3 && o.every(Number.isFinite) && o[2] >= 2.5 && Math.abs(o[0]) <= 90 && Math.abs(o[1]) <= 180);
  }
  assert.ok(data.puzzles.length >= 60);
});
test('answer is hidden: no other quake equals the hidden one', () => {
  for (const p of data.puzzles) assert.ok(!p.others.some((o) => o[0] === p.top.lat && o[1] === p.top.lng && o[2] === p.top.mag), p.date);
});
test('meta', () => {
  assert.ok(g.meta.howTo.length >= 2);
  assert.equal(g.meta.data, 'live');
  for (const s of g.meta.sources) assert.match(s.url, URLRE);
});
