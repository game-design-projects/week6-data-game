import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { simulate, hpOf, costOf, score, optimise, layouts, toPuzzle, explain, L, BUDGET, TOWERS, MAX_QUAKES, MIN_QUAKES } from './game.js';
import { makeRng, dailyIndex } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const fixture = JSON.parse(fs.readFileSync(new URL('./build/fixture.json', import.meta.url)));
const qs = [{ m: 4.5 }, { m: 5.0 }, { m: 6.0 }];

test('hp grows 4x per magnitude', () => { assert.equal(hpOf(4.5), 24); assert.equal(hpOf(5.5), 96); assert.ok(hpOf(6) > hpOf(5)); });
test('no towers means no damage', () => { const r = simulate(qs, Array(L).fill(0)); assert.equal(r.killedHP, 0); assert.equal(r.leaked.length, 3); });
test('cannons kill small enemies and frames are recorded', () => {
  const l = Array(L).fill(0); l[3] = 2; l[4] = 2;
  const r = simulate(qs, l, true);
  assert.ok(r.kills >= 1); assert.ok(r.killedHP > 0);
  assert.equal(r.frames.length, qs.length + L); assert.equal(r.frames[0].length, L);
});
test('cost, layouts count and budget', () => {
  assert.equal(costOf([1, 2, 3]), 6);
  let n = 0; for (const l of layouts()) { n++; assert.ok(costOf(l) <= BUDGET); assert.equal(l.length, L); }
  assert.equal(n, 7348);
});
test('score extremes: perfect, typical, worst', () => {
  assert.equal(score(100, 100), 100); assert.equal(score(0, 100), 0); assert.equal(score(70, 100), 49); assert.equal(score(500, 100), 100);
});
test('optimum beats or ties every layout and gives a spread of scores', () => {
  const p = data.pool[3];
  const opt = optimise(p.quakes);
  const scores = [];
  for (const l of layouts()) { const v = simulate(p.quakes, l).killedHP; assert.ok(v <= opt.killedHP); scores.push(score(v, opt.killedHP)); }
  scores.sort((a, b) => a - b);
  assert.equal(scores.at(-1), 100);
  assert.ok(scores[Math.floor(scores.length / 2)] < 90, 'median layout should not be near-perfect');
  assert.ok(scores[Math.floor(scores.length * 0.05)] < 40, 'bad layouts exist');
});

test('toPuzzle shapes the USGS fixture (one UTC day, time-ordered)', () => {
  const p = toPuzzle(fixture, '2026-10-14');
  assert.ok(p && p.date === '2026-10-14');
  assert.ok(p.quakes.length >= MIN_QUAKES && p.quakes.length <= MAX_QUAKES);
  const ts = p.quakes.map((q) => q.t);
  assert.deepEqual(ts, [...ts].sort());
  for (const q of p.quakes) { assert.ok(q.m >= 4.5 && q.m < 10); assert.match(q.t, /^\d\d:\d\d$/); assert.ok(q.place.length > 0); assert.ok(!/^\d+ km/.test(q.place)); }
  assert.ok(!p.quakes.some((q) => q.place === 'Nowhere'), 'events of other days are dropped');
  assert.equal(toPuzzle(fixture, '2026-01-01'), null);
  assert.equal(toPuzzle({}, '2026-10-14'), null);
});

test('every puzzle day 1-120 is valid', () => {
  const ids = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const p = game.puzzle({ data, day, date, slug: 'quake-defense', rng: makeRng(`q${day}`), pick: (a) => a[dailyIndex("quake-defense", day, a.length)] });
    assert.match(p.date, /^\d{4}-\d\d-\d\d$/);
    assert.ok(p.quakes.length >= MIN_QUAKES && p.quakes.length <= MAX_QUAKES, `day ${day}`);
    assert.ok(p.opt.killedHP > 0 && Number.isFinite(p.opt.killedHP));
    assert.ok(costOf(p.opt.layout) <= BUDGET);
    let prev = '';
    for (const q of p.quakes) {
      assert.ok(Number.isFinite(q.m) && q.m >= 4.5 && q.m <= 9.9);
      assert.match(q.t, /^\d\d:\d\d$/); assert.ok(q.t >= prev); prev = q.t;
      assert.ok(typeof q.place === 'string' && q.place.length && !/undefined|NaN|null/.test(q.place));
    }
    const ex = explain(p.quakes, [], p.opt.layout);
    assert.ok(ex.length >= 2 && ex.every((t) => t && !/undefined|NaN/.test(t)));
    ids.add(p.date);
  }
  assert.ok(ids.size >= 60, `pool too small: ${ids.size}`);
  assert.ok(data.pool.length >= 60);
  assert.equal(new Set(data.pool.map((d) => d.date)).size, data.pool.length, 'no duplicate dates');
});

test('towers table sane', () => { for (const t of TOWERS.slice(1)) assert.ok(t.cost > 0 && t.dmg > 0 && t.range >= 1 && t.short); });
