import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import game, { toPuzzle, selectCities, liveUrl, explain, climMean } from './game.js';
import { isoFromDay, makeRng, dailyIndex } from '../../engine/core.js';

const rd = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const d = rd('./data.json');
const fixture = rd('./build/fixture.json');

function validate(p, where) {
  assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/, where);
  assert.strictEqual(p.cities.length, 5, where);
  assert.strictEqual(new Set(p.cities.map((c) => c.country)).size, 5, `${where} countries`);
  assert.strictEqual(new Set(p.cities.map((c) => c.name)).size, 5, `${where} names`);
  for (const c of p.cities) {
    assert.ok(c.name && c.country && !('zh' in c), where);
    assert.strictEqual(c.t.length, 24, where);
    for (const v of c.t) assert.ok(Number.isFinite(v) && v > -75 && v < 60, `${where} temp ${v}`);
    assert.ok(c.cloud >= 0 && c.cloud <= 100, where);
    assert.ok(c.wind >= 0 && c.wind < 250, where);
    assert.ok(c.rain >= 0 && c.rain < 400, where);
    for (const k of ['rise', 'set']) assert.ok(c.rise == null || (c[k] >= 0 && c[k] < 24), `${where} ${k}`);
    assert.ok(Math.abs(c.lat) <= 90, where);
  }
}
function check(pz, where) {
  validate(pz, where);
  assert.strictEqual(pz.order.length, 5, where);
  assert.deepStrictEqual([...pz.order].sort(), [0, 1, 2, 3, 4], `${where} order is a permutation`);
  const labels = pz.cities.map((c) => `${c.name} (${c.country})`);
  assert.strictEqual(new Set(labels).size, 5, where);
}

test('snapshot pool: >= 60 valid puzzles, unique dates', () => {
  assert.ok(d.puzzles.length >= 60);
  assert.strictEqual(new Set(d.puzzles.map((p) => p.date)).size, d.puzzles.length);
  for (const p of d.puzzles) validate(p, p.date);
});

test('city pool and climatology are well-formed', () => {
  assert.ok(d.cities.length >= 40);
  for (const c of d.cities) {
    assert.ok(c.name && /^[\x20-\x7e\u00c0-\u024f]+$/.test(c.country), c.name);
    assert.ok(Number.isFinite(c.lat) && Number.isFinite(c.lng));
    assert.ok(c.dm.length >= 365);
    assert.ok(Number.isFinite(climMean(c, d.range, '2026-10-14')), c.name);
    assert.ok(Number.isFinite(climMean(c, d.range, '2026-02-28')), c.name);
  }
});

test('puzzle() for days 1-120 (snapshot and live-shaped) is valid and deterministic', () => {
  for (let day = 1; day <= 120; day++) {
    const date = isoFromDay(day);
    const args = { data: d, day, date, slug: 'forecast-match', rng: makeRng(`s${day}`), pick: (a) => a[dailyIndex('forecast-match', day, a.length)] };
    const pz = game.puzzle(args);
    check(pz, `snapshot day ${day}`);
    assert.deepStrictEqual(pz, game.puzzle({ ...args, rng: makeRng(`s${day}`) }));
    // live city choice is a pure function of the date and always yields 5 usable cities
    const cs = selectCities(d.cities, d.range, date);
    assert.strictEqual(cs.length, 5, date);
    assert.deepStrictEqual(cs, selectCities(d.cities, d.range, date));
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      assert.notStrictEqual(cs[i].country, cs[j].country);
      assert.ok(Math.abs(climMean(cs[i], d.range, date) - climMean(cs[j], d.range, date)) >= 3 - 1e-9, `${date} spread`);
    }
  }
});

test('toPuzzle shapes a real Open-Meteo multi-location fixture', () => {
  const cs = selectCities(d.cities, d.range, '2026-10-14');
  const p = toPuzzle(fixture, '2026-10-14', cs);
  assert.ok(p);
  validate(p, 'fixture');
  assert.deepStrictEqual(p.cities.map((c) => c.name), cs.map((c) => c.name));
  const pz = game.puzzle({ data: { ...d, live: p }, rng: makeRng('x'), pick: () => null });
  check(pz, 'live');
  assert.ok(pz.live);
  assert.match(liveUrl(cs, '2026-10-14'), /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=.*start_date=2026-10-14&end_date=2026-10-14/);
});

test('toPuzzle rejects incomplete data', () => {
  const cs = selectCities(d.cities, d.range, '2026-10-14');
  assert.strictEqual(toPuzzle(fixture.slice(0, 4), 'x', cs), null);
  const bad = JSON.parse(JSON.stringify(fixture));
  bad[2].hourly.temperature_2m[5] = null;
  assert.strictEqual(toPuzzle(bad, 'x', cs), null);
});

test('no answer leaks before the guess: visible text of a card carries no city identity', () => {
  // game.js renders only chart, sunrise/sunset, cloud/wind/rain per card; city names appear only in the select options
  const src = fs.readFileSync(new URL('./game.js', import.meta.url), 'utf8');
  const play = src.slice(src.indexOf('async play('));
  const bodyPart = play.slice(play.indexOf('const bodies'), play.indexOf('const answer'));
  assert.ok(!/\.name|\.country|\.lat\b/.test(bodyPart), 'card bodies must not reference city identity');
  for (const p of d.puzzles) for (const c of p.cities) assert.ok(!('lng' in c));
});

test('explain() is specific and names the facts', () => {
  const c = d.puzzles[0].cities[0];
  const s = explain(c, d.puzzles[0].date);
  assert.match(s, /mean/);
  assert.match(s, /daylight|polar/);
  assert.ok(!/undefined|NaN/.test(s));
  assert.ok(!/undefined|NaN/.test(explain({ ...c, rise: null, set: null }, '2026-06-21')));
});

test('scoring extremes of the match preset (2 attempts, 20 pts per card)', () => {
  // replicates engine formula: per*(attempts-k+1)/attempts, k = attempt in which the card was solved
  const score = (ks) => Math.round(ks.reduce((s, k) => s + 20 * (2 - k + 1) / 2, 0));
  assert.strictEqual(score([1, 1, 1, 1, 1]), 100);
  assert.strictEqual(score([1, 1, 2, 2, 2]), 70);
  assert.strictEqual(score([]), 0);
  // a pure random guesser (random permutation, then the engine locks hits and a 2nd try on the rest)
  const rng = makeRng('sim'); let tot = 0; const N = 4000;
  for (let t = 0; t < N; t++) {
    let open = [0, 1, 2, 3, 4]; const ks = [];
    for (let k = 1; k <= 2; k++) {
      const perm = rng.shuffle(open); const next = [];
      open.forEach((x, i) => (perm[i] === x ? ks.push(k) : next.push(x)));
      open = next;
    }
    tot += score(ks);
  }
  const avg = tot / N;
  assert.ok(avg < 35, `random guesser avg ${avg}`);
});
