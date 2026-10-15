import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { fmtT, dropPct, yearCell, lengthCell, daysBetween, timeTicks, biggestDrop, readingNotes } from './game.js';
import { leaks, progression } from './build/build.mjs';
import { makeRng, dailyIndex, isoFromDay } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const ISO = /^\d{4}-\d{2}-\d{2}$/;

test('fmtT', () => {
  assert.equal(fmtT(5.5), '5.50 s');
  assert.equal(fmtT(125), '2:05');
  assert.equal(fmtT(3725), '1:02:05');
});
test('dropPct', () => assert.equal(dropPct([[0, 100], [1, 40]]), 60));
test('yearCell', () => {
  assert.equal(yearCell({ year: 1990 }, { year: 1990 }).state, 'hit');
  assert.match(yearCell({ year: 1985 }, { year: 1996 }).text, /↑/);
  assert.equal(yearCell({ year: 1995 }, { year: 1996 }).state, 'near');
});
test('lengthCell', () => {
  assert.equal(lengthCell({ wr: 100 }, { wr: 100 }).state, 'hit');
  assert.match(lengthCell({ wr: 1000 }, { wr: 100 }).text, /↓/);
});
test('progression keeps only strict improvements, merges same-day', () => {
  const p = progression([{ date: '2020-01-02', t: 90 }, { date: '2020-01-01', t: 100 }, { date: '2020-01-02', t: 80 }, { date: '2020-02-01', t: 85 }, { date: '2020-03-01', t: 70 }]);
  assert.deepEqual(p, [['2020-01-01', 100], ['2020-01-02', 80], ['2020-03-01', 70]]);
});
test('leak detector', () => {
  assert.ok(leaks('EarthBound', 'EarthBound, RNG'));
  assert.ok(leaks('Super Mario Bros.: The Lost Levels', 'Mario'));
  assert.ok(!leaks('Portal', 'Out of Bounds'));
});
test('daysBetween / biggestDrop / readingNotes', () => {
  assert.equal(daysBetween('2020-01-01', '2020-01-31'), 30);
  const pts = [['2010-01-01', 100], ['2011-01-01', 90], ['2012-01-01', 50]];
  assert.equal(biggestDrop(pts).to[0], '2012-01-01');
  const notes = readingNotes({ year: 1990, pts }, '2026-10-15');
  assert.ok(notes.length >= 3);
  assert.ok(notes.some((n) => /2012-01-01/.test(n)));
});

test('pool: size and global uniqueness', () => {
  assert.ok(data.games.length >= 40, `pool ${data.games.length}`);
  assert.equal(new Set(data.games.map((g) => g.id)).size, data.games.length);
  assert.equal(new Set(data.games.map((g) => g.name.toLowerCase())).size, data.games.length);
});

test('pool: every entry is well-formed, leak-free and learnable', () => {
  for (const g of data.games) {
    const w = `${g.id} (${g.name})`;
    assert.ok(g.name && !/undefined|NaN/.test(g.name + g.cat), w);
    assert.ok(Number.isInteger(g.year) && g.year >= 1970 && g.year <= 2026, w + ' year');
    assert.ok(g.cat && g.platforms.every((p) => p && typeof p === 'string'), w + ' cat/platforms');
    assert.ok(g.pts.length >= 10, w + ' too few records');
    assert.equal(g.wr, g.pts.at(-1)[1], w + ' wr');
    assert.ok(!leaks(g.name, g.cat), w + ` category leaks name: ${g.cat}`);
    assert.ok(!g.platforms.some((p) => leaks(g.name, p) && p.toLowerCase().includes(g.name.toLowerCase())), w + ' platform leaks');
    g.pts.forEach(([d, s], i) => {
      assert.match(d, ISO, w);
      assert.ok(Number.isFinite(s) && s > 0 && s < 1e6, w + ' time');
      if (i) {
        assert.ok(d > g.pts[i - 1][0], w + ' dates must strictly increase');
        assert.ok(s < g.pts[i - 1][1], w + ' times must strictly decrease');
        assert.ok(s > g.pts[i - 1][1] * 0.1, w + ' implausible drop');
      }
    });
    assert.ok(g.pts[0][0] >= '1990-01-01' && g.pts.at(-1)[0] <= '2026-10-15', w + ' date range');
    // guessable: the curve must have some spread, not a near-flat line
    assert.ok(dropPct(g.pts) >= 3, w + ' curve nearly flat');
  }
});

test('puzzle() days 1-120: valid, selectable, deterministic, no repeats before pool is used up', () => {
  const ids = new Set(data.games.map((g) => g.id));
  const seen = [];
  for (let day = 1; day <= 120; day++) {
    const date = isoFromDay(day);
    const mk = () => game.puzzle({ data, day, date, slug: 'world-record', rng: makeRng(`world-record:${date}`), pick: (arr) => arr[dailyIndex('world-record', day, arr.length)] });
    const p = mk();
    assert.deepEqual(p, mk());
    assert.ok(ids.has(p.id), `day ${day}`);
    seen.push(p.id);
  }
  const n = Math.min(data.games.length, 120);
  assert.equal(new Set(seen.slice(0, n)).size, n, 'no repeats until the pool is used up');
});

test('feedback is consistent for every answer vs. every guess', () => {
  for (const a of data.games) for (const g of data.games) {
    const y = yearCell(g, a), l = lengthCell(g, a);
    if (g.id === a.id) assert.ok(y.state === 'hit' && l.state === 'hit');
    assert.ok(y.text && l.text);
  }
});

test('scoring extremes (engine default 100*(max-n+1)/max, max 6)', () => {
  const s = (n, won) => (won ? Math.round((100 * (6 - n + 1)) / 6) : 0);
  assert.equal(s(1, true), 100);
  assert.equal(s(2, true), 83);
  assert.equal(s(6, true), 17);
  assert.equal(s(6, false), 0);
});

test('timeTicks gives a few round values inside the range', () => {
  assert.deepEqual(timeTicks(100, 4000), [120, 300, 600, 900, 1800, 3600]);
  for (const g of data.games) {
    const lo = Math.min(...g.pts.map((p) => p[1])) * 0.85, hi = Math.max(...g.pts.map((p) => p[1])) * 1.15;
    const t = timeTicks(lo, hi);
    assert.ok(t.length >= 2 && t.length <= 7, `${g.id}: ${t.length} ticks`);
  }
});
