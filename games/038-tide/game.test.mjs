import test from 'node:test';
import assert from 'node:assert/strict';
import { peaks, analyse } from './game.js';
const sine = (periodH, n = 72, amp = 1) => Array.from({ length: n }, (_, h) => amp * Math.sin((2 * Math.PI * h) / periodH) + amp);
test('peaks semidiurnal', () => assert.equal(peaks(sine(12.42)).length, 6));
test('analyse diurnal', () => { const a = analyse(sine(24.84)); assert.match(a.type, /Diurnal/); assert.ok(Math.abs(a.range - 2) < 0.05); });
test('analyse semidiurnal', () => assert.match(analyse(sine(12.42)).type, /Semidiurnal/));
test('plateau counted once', () => assert.deepEqual(peaks([0, 1, 1, 0]), [1]));
test('mixed tide', () => {
  const v = Array.from({ length: 72 }, (_, h) => Math.sin((2 * Math.PI * h) / 12.42) + 0.9 * Math.sin((2 * Math.PI * h) / 24.84 + 1) + 2);
  assert.equal(analyse(v).kind, 'mixed');
});

import fs from 'node:fs';
import game, { toPuzzle, region, dailyHighs } from './game.js';
import { makeRng, dailyIndex, addDays } from '../../engine/core.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const fixture = JSON.parse(fs.readFileSync(new URL('./build/fixture.json', import.meta.url)));

test('toPuzzle shapes the CO-OPS fixture', () => {
  const p = toPuzzle(fixture, '8518750', '2026-10-15');
  assert.equal(p.v.length, 72);
  assert.ok(p.v.every(Number.isFinite));
  assert.equal(p.begin, '2026-10-15');
  assert.equal(analyse(p.v).kind, 'semi');
});
test('toPuzzle rejects bad responses', () => {
  assert.throws(() => toPuzzle({ error: { message: 'x' } }, '1', 'd'));
  assert.throws(() => toPuzzle({ predictions: fixture.predictions.slice(0, 10) }, '1', 'd'));
  assert.throws(() => toPuzzle({ predictions: fixture.predictions.map((p) => ({ ...p, v: '1.0' })) }, '1', 'd'), /flat/);
});
test('dailyHighs: semi has two per day', () => {
  const h = dailyHighs(toPuzzle(fixture, '1', 'd').v);
  assert.ok(h.every((x) => x.length === 2 || x.length === 1));
});

test('pool: every puzzle for days 1-120 is valid', () => {
  const ids = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = addDays('2026-10-01', day - 1);
    const pick = (arr) => arr[dailyIndex('tide', day, arr.length)];
    const p = game.puzzle({ data, day, date, slug: 'tide', rng: makeRng('x'), pick });
    const st = data.stations.find((s) => s.id === p.id);
    assert.ok(st, `day ${day}: station exists`);
    assert.equal(p.v.length, 72);
    assert.ok(p.v.every((x) => typeof x === 'number' && Number.isFinite(x)), `day ${day} finite`);
    const a = analyse(p.v);
    assert.ok(a.range >= 0.05 && a.range < 15, `day ${day} range ${a.range}`);
    assert.ok(a.hi.length >= 2 && a.hi.length <= 8, `day ${day} highs ${a.hi.length}`);
    assert.ok(Math.abs(st.lat) <= 90 && Math.abs(st.lng) <= 180);
    assert.ok(st.name && !/undefined|NaN/.test(st.name));
    assert.ok(region(st));
    assert.match(p.begin, /^\d{4}-\d{2}-\d{2}$/);
    JSON.stringify(p);
    ids.add(p.id);
  }
  assert.ok(ids.size >= 100);
  const all = data.stations.map((s) => s.id);
  assert.equal(new Set(all).size, all.length, 'no duplicate ids');
  assert.ok(data.stations.length >= 60);
});

test('pool: no answer leaks in public fields (puzzle returns no name/coords)', () => {
  const p = game.puzzle({ data, day: 3, date: '2026-10-03', slug: 'tide', rng: makeRng('x'), pick: (a) => a[0] });
  assert.deepEqual(Object.keys(p).sort(), ['begin', 'id', 'live', 'v']);
});

test('pool: tide types are mixed (difficulty spread)', () => {
  const kinds = new Set(data.stations.map((s) => analyse(s.v).kind));
  assert.equal(kinds.size, 3);
});
