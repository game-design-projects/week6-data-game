import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { sharedCount, scoreFor, analyze, preCountryText, explain, destCodes, maskCity } from './game.js';
import { makeRng, dailyIndex } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('sharedCount', () => { assert.equal(sharedCount(['A', 'B', 'C'], ['B', 'C', 'D']), 2); assert.equal(sharedCount([], ['A']), 0); });

test('scoring extremes', () => {
  assert.equal(scoreFor(1, true), 100);
  assert.equal(scoreFor(2, true), 83);
  assert.equal(scoreFor(6, true), 17);
  assert.equal(scoreFor(6, false), 0);
  for (let i = 1; i < 6; i++) assert.ok(scoreFor(i, true) > scoreFor(i + 1, true));
});

test('maskCity', () => { assert.equal(maskCity('Air Berlin', 'Berlin'), 'Air ▇▇▇'); assert.equal(maskCity('X', ''), 'X'); });

test('data pool is well formed', () => {
  const by = new Map(data.airports.map((a) => [a.c, a]));
  assert.equal(by.size, data.airports.length, 'duplicate airport codes');
  for (const a of data.airports) {
    assert.match(a.c, /^[A-Z]{3}$/);
    assert.ok(a.n && a.city && a.co, a.c);
    assert.match(a.co, /^[A-Za-z][A-Za-z ,.'()-]+$/, 'country name for ' + a.c);
    assert.ok(Number.isFinite(a.lat) && Math.abs(a.lat) <= 90 && Number.isFinite(a.lng) && Math.abs(a.lng) <= 180, a.c);
  }
  assert.equal(new Set(data.optionCodes).size, data.optionCodes.length);
  assert.ok(data.puzzles.length >= 60);
});

test('every puzzle day 1-120 is valid and leak-free', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, date: '', slug: 'departures', rng: makeRng(day), pick: (arr) => arr[dailyIndex('departures', day, arr.length)] });
    assert.ok(p.code && data.optionCodes.includes(p.code), `day ${day}: answer must be selectable`);
    seen.add(p.code);
    const a = analyze(data, p.code);
    assert.ok(a.codes.length >= 22 && a.codes.length <= 230, `${p.code} dest count`);
    assert.equal(new Set(a.codes).size, a.codes.length, `${p.code} duplicate dests`);
    assert.ok(!a.codes.includes(p.code), 'no self route');
    for (const d of a.dests) { assert.ok(d, 'dest exists'); assert.notEqual(d.city, a.ans.city, `${p.code}: dest in same city leaks the answer`); }
    assert.ok(a.pz.al.length >= 1 && a.pz.al.every(([nm, k]) => nm && Number.isInteger(k) && k > 0 && k <= a.codes.length), `${p.code} airlines`);
    const text = preCountryText(data, p.code);
    assert.ok(!/undefined|NaN|null/.test(text), `${p.code} text has junk`);
    assert.ok(!new RegExp(`(^|[^\\p{L}])${a.ans.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'iu').test(text), `${p.code}: city name "${a.ans.city}" visible before the reveal`);
    assert.ok(!text.includes(a.ans.n), `${p.code}: airport name visible`);
    assert.ok(!new RegExp(`\\b${p.code}\\b`).test(text), `${p.code}: own IATA visible`);
    const ex = explain(a, p.code);
    assert.ok(ex.length > 40 && !/undefined|NaN/.test(ex));
  }
  assert.ok(seen.size >= 60, 'at least 60 distinct puzzles in 120 days: ' + seen.size);
});

test('routes lists reference known airports', () => {
  const by = new Set(data.airports.map((a) => a.c));
  for (const c of data.optionCodes) for (const d of destCodes(data, c)) assert.ok(by.has(d), `${c}->${d}`);
});
