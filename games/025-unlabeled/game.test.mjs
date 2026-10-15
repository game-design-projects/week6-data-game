import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { windows, monthKey, yearScore, nameScore, recAt, windowInfo, yearRange, WIN, MIN_YEAR } from './game.js';
import { dailyIndex } from '../../engine/core.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const byId = new Map(data.series.map((s) => [s.id, s]));

test('windows >= 60 and in range', () => {
  const w = windows(data);
  assert.ok(w.length >= 60, String(w.length));
  for (const x of w) {
    const s = byId.get(x.id);
    assert.ok(x.off + WIN <= s.vals.length);
    assert.ok(monthKey(s.start, x.off).y >= MIN_YEAR);
  }
});
test('monthKey', () => { assert.deepEqual(monthKey('1948-01', 13), { y: 1949, m: 2 }); });
test('scoring extremes', () => {
  assert.equal(yearScore(2000, 2000), 100);
  assert.ok(yearScore(1990, 2000) < yearScore(1998, 2000));
  const [lo, hi] = yearRange(data);
  assert.ok(yearScore(lo, hi) < 5);
  assert.deepEqual([1, 2, 3].map((n) => nameScore(n, true)), [50, 33, 17]);
  assert.equal(nameScore(3, false), 0);
  const total = (n, won, err) => nameScore(n, won) + yearScore(2000, 2000 + err) / 2;
  assert.equal(total(1, true, 0), 100);
  assert.ok(total(2, true, 3) > 60 && total(2, true, 3) < 75);
  assert.ok(total(3, false, hi - lo) < 3);
});
test('recAt: 2020-04 is a recession, 2015-01 is not', () => { assert.ok(recAt(data.rec, 2020, 4)); assert.ok(!recAt(data.rec, 2015, 1)); });
test('series: fields set, values finite', () => {
  assert.equal(data.series.length, 15);
  for (const s of data.series) {
    assert.ok(s.unit && s.zh && s.tip && s.id, s.id);
    assert.ok(s.vals.length > WIN);
    for (const v of s.vals) assert.ok(Number.isFinite(v), s.id);
  }
  assert.equal(new Set(data.series.map((s) => s.id)).size, 15);
  assert.equal(new Set(data.series.map((s) => s.zh)).size, 15);
});
test('pool validity over puzzle days 1-120', () => {
  const [lo, hi] = yearRange(data);
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const p = game.puzzle({ data, day, date, slug: 'unlabeled', rng: null, pick: (arr) => arr[dailyIndex('unlabeled', day, arr.length)] });
    assert.ok(byId.get(p.id), `day ${day}`);
    assert.ok(Number.isInteger(p.year) && p.year >= lo && p.year <= hi, `year ${p.year}`);
    assert.ok(p.month >= 1 && p.month <= 12);
    const info = windowInfo(data, p);
    assert.equal(info.pts.length, WIN);
    assert.ok(info.pts.every((q) => Number.isFinite(q.v)));
    assert.ok(info.hi.v > info.lo.v);
    assert.equal(info.pts[0].k.y, p.year);
    seen.add(`${p.id}@${p.off}`);
  }
  assert.equal(seen.size, 120);
});
test('every window is non-flat and shows at least one recession', () => {
  for (const w of windows(data)) {
    const info = windowInfo(data, w);
    assert.ok(info.hi.v > info.lo.v, `${w.id}@${w.off}`);
    assert.ok(info.spans.length >= 1, `${w.id}@${w.off} no recession`);
  }
});
test('no leaks in static copy', () => {
  for (const s of data.series) assert.ok(!game.meta.tagline.includes(s.zh) && !game.meta.tagline.includes(s.id));
});
