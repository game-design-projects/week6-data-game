import { test } from 'node:test';
import assert from 'node:assert/strict';
import game, { buildPairs, lessonStats, monthLabel } from './game.js';
import { makeRng } from '../../engine/core.js';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

function mkrng(seed) { let s = seed; const f = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return { shuffle: (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; } }; }

test('data: sane months, zips and boroughs', () => {
  const months = Object.keys(data.months);
  assert.ok(months.length >= 60, 'pool of at least 60 months');
  for (const m of months) {
    assert.match(m, /^20\d\d-\d\d$/);
    const zips = new Set();
    for (const [z, f, t] of data.months[m]) {
      assert.match(z, /^1\d{4}$/);
      assert.ok(!zips.has(z), 'duplicate zip ' + z + m); zips.add(z);
      assert.ok(Number.isInteger(f) && Number.isInteger(t) && f >= 1 && f <= t && t >= 60 && t < 20000, `${m} ${z} ${f}/${t}`);
      assert.ok(data.boros[z], 'borough for ' + z);
    }
    assert.ok(zips.size >= 30);
  }
});

test('pairs: 5 rounds, unique zips, clear gaps, hardening ratios', () => {
  for (const m of ['2019-03', '2023-08', '2021-08', '2022-12']) {
    const pairs = buildPairs(data.months[m], mkrng(7));
    assert.equal(pairs.length, 5);
    assert.equal(new Set(pairs.flat()).size, 10);
    const mp = new Map(data.months[m].map((r) => [r[0], r[1]]));
    for (const [a, b] of pairs) { assert.ok(Math.abs(mp.get(a) - mp.get(b)) >= 6); assert.ok(Math.min(mp.get(a), mp.get(b)) >= 12); }
  }
});

test('puzzle pool days 1-120: valid, deterministic, 5 rounds', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const args = () => { const rng = makeRng(`rat-race:${day}`); return { data, day, date, slug: 'rat-race', rng, pick: (arr) => arr[(day - 1) % arr.length] }; };
    const p = game.puzzle(args());
    assert.deepEqual(p, game.puzzle(args()));
    assert.ok(data.months[p.month]);
    assert.equal(p.pairs.length, 5, `day ${day} ${p.month}`);
    const by = new Map(data.months[p.month].map((r) => [r[0], r]));
    for (const pr of p.pairs) {
      assert.equal(pr.length, 2); assert.notEqual(pr[0], pr[1]);
      for (const z of pr) { const r = by.get(z); assert.ok(r && Number.isFinite(r[1]) && Number.isFinite(r[2])); }
      assert.notEqual(by.get(pr[0])[1], by.get(pr[1])[1]);
    }
    seen.add(p.month);
  }
  assert.ok(seen.size >= 60);
});

test('scoring extremes: always-more-inspections strategy beats coin flip but is not perfect', () => {
  let right = 0, n = 0;
  for (const m of Object.keys(data.months)) {
    const by = new Map(data.months[m].map((r) => [r[0], r]));
    for (const [a, b] of buildPairs(data.months[m], mkrng(m.length + +m.slice(5)))) {
      const x = by.get(a), y = by.get(b);
      const guess = x[2] >= y[2] ? x : y, truth = x[1] > y[1] ? x : y;
      right += guess === truth; n++;
    }
  }
  const acc = right / n;
  assert.ok(acc > 0.55 && acc < 0.92, 'heuristic accuracy ' + acc);
});

test('lessonStats and monthLabel', () => {
  const by = new Map([['a', ['a', 50, 100]], ['b', ['b', 30, 400]], ['c', ['c', 20, 80]], ['d', ['d', 10, 40]]]);
  const L = lessonStats([['a', 'b'], ['c', 'd']], by);
  assert.deepEqual(L, { countWins: 1, rateWins: 1, upsets: 1, n: 2 });
  assert.equal(monthLabel('2022-03'), '2022 年 3 月');
});
