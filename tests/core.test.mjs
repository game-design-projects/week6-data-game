import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../engine/core.js';

test('dayNumber: epoch is #1 and round-trips', () => {
  assert.equal(C.dayNumber(C.EPOCH), 1);
  assert.equal(C.dayNumber(C.addDays(C.EPOCH, 13)), 14);
  for (const n of [1, 2, 30, 365, 1000]) assert.equal(C.dayNumber(C.isoFromDay(n)), n);
});

test('addDays crosses month/year boundaries', () => {
  assert.equal(C.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(C.addDays('2028-03-01', -1), '2028-02-29');
});

test('makeRng is deterministic per seed', () => {
  const a = C.makeRng('x'), b = C.makeRng('x'), c = C.makeRng('y');
  const sa = [a.next(), a.next(), a.next()];
  assert.deepEqual(sa, [b.next(), b.next(), b.next()]);
  assert.notDeepEqual(sa, [c.next(), c.next(), c.next()]);
  const r = C.makeRng(1);
  for (let i = 0; i < 200; i++) {
    const v = r.int(3, 5);
    assert.ok(v >= 3 && v <= 5);
  }
});

test('dailyIndex visits every puzzle once per cycle', () => {
  const n = 17;
  const seen = new Set();
  for (let d = 1; d <= n; d++) seen.add(C.dailyIndex('demo', d, n));
  assert.equal(seen.size, n);
  // next cycle is also a full permutation
  const seen2 = new Set();
  for (let d = n + 1; d <= 2 * n; d++) seen2.add(C.dailyIndex('demo', d, n));
  assert.equal(seen2.size, n);
  // negative / pre-epoch days still land in range
  assert.ok(C.dailyIndex('demo', -5, n) >= 0);
  assert.throws(() => C.dailyIndex('demo', 1, 0));
});

test('haversine and bearing', () => {
  const nyc = { lat: 40.7128, lng: -74.006 }, london = { lat: 51.5074, lng: -0.1278 };
  const km = C.haversineKm(nyc, london);
  assert.ok(Math.abs(km - 5570) < 15, `got ${km}`);
  assert.equal(C.arrow(C.bearingDeg(nyc, london)), '↗');
  assert.equal(C.arrow(0), '↑');
  assert.equal(C.arrow(359), '↑');
  assert.equal(C.arrow(180), '↓');
});

test('scores', () => {
  assert.equal(C.expScore(0, 100), 100);
  assert.equal(C.expScore(100, 100), 37);
  assert.equal(C.linScore(50, 100), 50);
  assert.equal(C.linScore(500, 100), 0);
  assert.equal(C.logError(100, 10), 1);
  assert.equal(C.logError(-1, 10), Infinity);
  assert.equal(C.pctError(110, 100).toFixed(2), '0.10');
  assert.equal(C.jaccard(['a', 'b'], ['b', 'c']), 1 / 3);
  assert.equal(C.f1(['a', 'b'], ['a', 'b']), 1);
  assert.equal(C.f1(['x'], ['a']), 0);
  assert.ok(Math.abs(C.pearson([1, 2, 3], [2, 4, 6]) - 1) < 1e-12);
});

test('emojiBar length is constant', () => {
  for (const f of [0, 0.1, 0.5, 0.55, 0.99, 1, 2]) assert.equal([...C.emojiBar(f, 5)].length, 5);
  assert.equal(C.emojiBar(1, 3), '🟩🟩🟩');
  assert.equal(C.emojiBar(0, 3), '⬜⬜⬜');
});

test('normalizeResult and combine', () => {
  assert.throws(() => C.normalizeResult(null));
  const r = C.normalizeResult({ score: 150, max: 100 });
  assert.equal(r.score, 100);
  assert.equal(r.win, true);
  const c = C.combine([{ score: 50, max: 100, emoji: 'A', summary: 'x' }, { score: 3, max: 5, emoji: 'B' }]);
  assert.equal(c.score, 53);
  assert.equal(c.max, 105);
  assert.equal(c.emoji, 'A B');
  assert.equal(c.summary, 'x');
});

test('formatting', () => {
  assert.equal(C.fmtNum(1234567), '1,234,567');
  assert.equal(C.fmtCompact(3400000), '3.4M');
  assert.equal(C.fmtKm(0.25), '250 m');
  assert.equal(C.fmtKm(1234.4), '1,234 km');
  assert.equal(C.fmtMoney(3.5), '$3.50');
  assert.equal(C.fmtPct(0.125, 1), '12.5%');
});

test('normalize strips accents and punctuation', () => {
  assert.equal(C.normalize('  São-Paulo!! '), 'sao paulo');
  assert.equal(C.normalize('Côte d’Ivoire'), 'cote d ivoire');
  assert.equal(C.normalize('北京'), '北京');
});
