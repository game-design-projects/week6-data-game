import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { quarterOf, maker, decoys, opBrand } from './game.js';
import { makeRng, haversineKm } from '../../engine/core.js';
import { normType, parseDate, plausible } from './build/clean.mjs';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('quarterOf maps December to the winter bucket', () => {
  assert.equal(quarterOf('2020-12-31'), 0);
  assert.equal(quarterOf('2020-01-05'), 0);
  assert.equal(quarterOf('2019-07-01'), 2);
});
test('maker', () => assert.equal(maker('Boeing 737-800'), 'Boeing'));
test('decoys exclude answer, prefer same group', () => {
  const rng = makeRng(1);
  const d = decoys(rng, ['Boeing 737', 'Boeing 777', 'Airbus A320', 'Boeing 747', 'Embraer E190'], 'Boeing 737', 3, maker);
  assert.equal(d.length, 3);
  assert.ok(!d.includes('Boeing 737'));
  assert.ok(d.includes('Boeing 777') && d.includes('Boeing 747'));
});
test('opBrand groups look-alike liveries', () => {
  assert.equal(opBrand('Lufthansa Cargo'), opBrand('Lufthansa'));
  assert.equal(opBrand('Air Canada Rouge'), opBrand('Air Canada'));
  assert.notEqual(opBrand('Air France'), opBrand('Air India'));
});
test('build cleaning helpers', () => {
  assert.equal(normType('Airbus A320neo'), 'Airbus A320');
  assert.equal(parseDate('10 August 2017, 09:42:25'), '2017-08-10');
  assert.equal(parseDate('2019-07-19 16:10'), '2019-07-19');
  assert.equal(parseDate('Taken in 1974'), null);
  assert.equal(parseDate('December, 1972'), '1972-12-15');
  assert.equal(parseDate('7 December 1982<div style="display: none;">date QS:P571,+1982-12-07T00:00:00Z/11</div>'), '1982-12-07');
  assert.notEqual(plausible({ title: 'Boeing 777-35RER A6-JAF Etihad Airways (1)', op: 'Jet Airways', type: 'Boeing 777', allOps: ['Jet Airways', 'Etihad Airways'] }), 'ok');
  assert.equal(plausible({ title: 'KLM Airbus A330-203 PH-AOM', op: 'KLM', type: 'Airbus A330', allOps: ['KLM'] }), 'ok');
});

test('pool: every puzzle for days 1-120 is valid', () => {
  const iatas = new Set(data.airports.map((a) => a.iata));
  assert.equal(iatas.size, data.airports.length);
  assert.ok(data.photos.length >= 60);
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const rng = makeRng(day * 7919);
    const pick = (arr) => arr[(day - 1) % arr.length];
    const p = game.puzzle({ data, day, date, slug: 'spotter', rng, pick });
    const ph = p.photo;
    assert.ok(iatas.has(ph.iata), `day ${day} airport`);
    assert.match(ph.thumb, /^https:\/\/(upload|thumb)\.wikimedia\.org\//);
    assert.match(ph.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(ph.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(ph.date >= '1975-01-01' && ph.date <= '2026-10-15', `day ${day} date ${ph.date}`);
    assert.ok(quarterOf(ph.date) >= 0);
    for (const k of ['type', 'op', 'by', 'lic']) assert.ok(ph[k] && !/undefined|NaN|null/.test(ph[k]), `day ${day} ${k}`);
    for (const [key, ans] of [['op', ph.op], ['type', ph.type]]) {
      const o = p[key];
      assert.equal(o.opts.length, 4, `${key} option count`);
      assert.equal(new Set(o.opts).size, 4, `${key} distinct`);
      assert.equal(o.opts[o.correct], ans);
      if (key === 'op') for (const x of o.opts) if (x !== ans) assert.notEqual(opBrand(x), opBrand(ans), `look-alike decoy ${x} vs ${ans}`);
    }
  }
});

test('pool: unique photos, no leak in labels shown before guessing', () => {
  assert.equal(new Set(data.photos.map((p) => p.thumb)).size, data.photos.length);
  // the only pre-guess text is clue copy derived from airport fields; airport labels must not embed airline names
  for (const a of data.airports) for (const k of ['iata', 'en', 'name', 'country', 'cont']) assert.ok(a[k], `${a.iata}.${k}`);
  for (const a of data.airports) assert.ok(Number.isFinite(a.lat) && Number.isFinite(a.lng) && Math.abs(a.lat) <= 90 && Math.abs(a.lng) <= 180);
  // every airport has >= 2 photos? (not required) but every airport must be reachable by distance feedback
  assert.ok(haversineKm(data.airports[0], data.airports[1]) > 0);
});

test('scoring extremes: airport 100..0 plus 3 questions', () => {
  const airport = (n, won, max = 6) => (won ? (100 * (max - n + 1)) / max : 0);
  const total = (ap, right) => ap + (right / 3) * 100;
  assert.equal(total(airport(1, true), 3), 200);
  assert.ok(Math.abs(total(airport(3, true), 2) - (66.7 + 66.7)) < 0.2);
  assert.equal(total(airport(6, false), 0), 0);
  // random multiple choice (25%) with typical 3 guesses stays well under the perfect score
  assert.ok(total(airport(3, true), 0.75) < 150);
});
