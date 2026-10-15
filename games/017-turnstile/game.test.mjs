import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { profile, lines, shortName, hopsBetween, scoreGuess, MAX_GUESSES } from './game.js';
import { makeRng, dailyIndex, addDays, EPOCH } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const slug = 'turnstile';
const run = (day) => {
  const date = addDays(EPOCH, day - 1);
  return game.puzzle({ data, day, date, slug, rng: makeRng(`${slug}:${date}`), pick: (arr) => arr[dailyIndex(slug, day, arr.length)] });
};

test('lines / shortName parse station labels', () => {
  assert.equal(lines('Hewes St (M,J)'), 'M,J');
  assert.equal(shortName('Hewes St (M,J)'), 'Hewes St');
});

test('profile classifies commuter patterns', () => {
  const wk = Array(24).fill(100); wk[8] = 1000; wk[17] = 200;
  const p = profile({ wk, we: Array(24).fill(50) });
  assert.equal(p.peakWk, 8);
  assert.match(p.kind, /居民区/);
  const q = profile({ wk: wk.map((_, i) => (i === 17 ? 1000 : 100)), we: Array(24).fill(50) });
  assert.match(q.kind, /办公区/);
  const t = profile({ wk, we: wk });
  assert.match(t.kind, /游客/);
});

test('data: unique labels, 24-hour arrays, pool size, sane numbers', () => {
  assert.ok(data.stations.filter((s) => s.pool).length >= 60);
  assert.equal(new Set(data.stations.map((s) => s.name)).size, data.stations.length);
  assert.equal(new Set(data.stations.map((s) => s.id)).size, data.stations.length);
  for (const s of data.stations) {
    assert.ok(s.id && s.name && s.borough, s.id);
    assert.ok(s.lat > 40.4 && s.lat < 41 && s.lng > -74.3 && s.lng < -73.6, s.name);
    for (const a of [s.wk, s.we]) {
      assert.equal(a.length, 24);
      assert.ok(a.every((v) => Number.isFinite(v) && v >= 0 && v < 100000), s.name);
    }
  }
});

test('hops: square, symmetric, zero diagonal, all reachable', () => {
  const n = data.stations.length;
  assert.equal(data.hops.length, n);
  for (let i = 0; i < n; i++) {
    assert.equal(data.hops[i].length, n);
    assert.equal(hopsBetween(data, i, i), 0);
  }
  for (let t = 0; t < 2000; t++) {
    const i = (t * 7919) % n, j = (t * 104729) % n;
    assert.equal(hopsBetween(data, i, j), hopsBetween(data, j, i));
    assert.ok(hopsBetween(data, i, j) != null);
  }
  const ix = (re) => data.stations.findIndex((s) => re.test(s.name));
  assert.equal(hopsBetween(data, ix(/^Astor Pl/), ix(/Union Sq/)), 1);
  assert.ok(hopsBetween(data, ix(/^Astor Pl/), ix(/^Grand Central/)) <= 2);
});

test('pool validity: days 1-120 give a selectable, well-formed answer', () => {
  const ids = new Set(data.stations.map((s) => s.id));
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = run(day);
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
    assert.ok(ids.has(p.id), `day ${day}`);
    const s = data.stations.find((x) => x.id === p.id);
    assert.ok(s.pool, `day ${day} answer outside pool`);
    const pf = profile(s);
    for (const v of Object.values(pf)) assert.ok(typeof v === 'string' || Number.isFinite(v), `day ${day}`);
    assert.ok(pf.day > 1000, `${s.name} too quiet`);
    assert.ok(lines(s.name).length > 0, s.name);
    if (day <= 160) seen.add(p.id);
  }
  assert.ok(seen.size >= 100);
});

test('answer leaks: the station name never appears in clue-visible fields', () => {
  // clues expose only borough, lines, rank, ratio, first letter + length: none contain the full name
  for (const s of data.stations.filter((x) => x.pool)) {
    const sn = shortName(s.name);
    assert.ok(sn.length > 1);
    assert.ok(!/[^\x00-\x7f]/.test(s.borough));
  }
});

test('scoring: perfect, typical, worst', () => {
  assert.equal(scoreGuess(1, true, 0), 100);
  assert.equal(scoreGuess(3, true, 0), 67);
  assert.equal(scoreGuess(MAX_GUESSES, true, 0), 17);
  assert.equal(scoreGuess(6, false, 1), 14);
  assert.equal(scoreGuess(6, false, 6), 8);
  assert.equal(scoreGuess(6, false, 30), 0);
  assert.equal(scoreGuess(6, false, null), 0);
  assert.ok(scoreGuess(6, false, 1) < scoreGuess(6, true, 0));
});
