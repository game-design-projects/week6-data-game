import test from 'node:test';
import assert from 'node:assert/strict';
import game, { yearScore, yearOf, songScore, runFacts, patternText, buildClues } from './game.js';
import { parse, cleanTitle } from './build/build-lib.mjs';
import data from './data.json' with { type: 'json' };

const mkRng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); };
// deterministic stand-in for the engine's daily pick: a seeded permutation over days
const perm = (() => { const a = data.puzzles.map((_, i) => i); const r = mkRng(54); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; })();
const puzzleFor = (day) => game.puzzle({ data, day, date: '', slug: 'chart-run', rng: mkRng(day), pick: (arr) => arr[perm[(day - 1) % perm.length]] });

test('scoring extremes', () => {
  assert.equal(yearScore(1990, 1990), 100);
  assert.ok(yearScore(1995, 1990) < 40 && yearScore(1995, 1990) > 35);
  assert.ok(yearScore(1960, 2020) <= 1);
  assert.equal(songScore(1, true), 100);
  assert.equal(songScore(6, true), 17);
  assert.equal(songScore(6, false), 0);
  assert.ok(songScore(2, true) > songScore(3, true));
  // typical: 8 years off, found on 3rd try => ~20 + 67
  assert.ok(yearScore(1998, 1990) + songScore(3, true) > 60);
});
test('yearOf / csv', () => {
  assert.equal(yearOf('1999-05-01'), 1999);
  assert.deepEqual(parse('2020-01-01,1,"Say ""Hi"", Bob",X,NA'), ['2020-01-01', '1', 'Say "Hi", Bob', 'X', 'NA']);
  assert.equal(cleanTitle('Kokomo (From"Cocktail" )'), 'Kokomo (From "Cocktail")');
});
test('runFacts', () => {
  const f = runFacts([50, 20, 5, 1, 1, 3, null, 8]);
  assert.deepEqual([f.first, f.peak, f.peakIdx, f.weeks, f.atPeak, f.gaps, f.top10], [50, 1, 3, 7, 2, 1, 5]);
});

test('pool validity over 120 days', () => {
  const [y0, y1] = data.span;
  assert.ok(data.puzzles.length >= 60 && y1 >= 2025);
  const keys = new Set();
  data.options.forEach((o, i) => {
    assert.ok(o.t && o.p && !/undefined|NaN|\bnull\b/.test(o.t + o.p), `option ${i}`);
    assert.ok(o.y >= y0 && o.y <= y1 && o.k >= 1 && o.k <= 10 && o.w >= 1 && o.w <= 120, `option range ${i}`);
    const k = o.t + '||' + o.p; assert.ok(!keys.has(k), 'dup ' + k); keys.add(k);
  });
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = puzzleFor(day);
    assert.ok(Number.isInteger(p.i) && p.i >= 0 && p.i < data.puzzles.length);
    const pz = data.puzzles[p.i]; const ans = data.options[pz.o];
    assert.ok(ans, 'answer option exists');
    assert.match(pz.start, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(yearOf(pz.start), ans.y);
    assert.ok(pz.run.length >= 20 && pz.run.length <= 70);
    assert.ok(pz.run.every((x) => x === null || (Number.isInteger(x) && x >= 1 && x <= 100)));
    assert.ok(pz.run[0] != null && pz.run.at(-1) != null, 'run begins/ends on chart');
    const f = runFacts(pz.run);
    assert.equal(f.peak, ans.k); assert.equal(f.weeks, ans.w);
    assert.ok(ans.k <= 3 && ans.w >= 20);
    // pool entries are unique songs
    assert.ok(!seen.has(pz.o) || day > data.puzzles.length);
    seen.add(pz.o);
    // distractors are distinct from the answer and selectable
    assert.equal(data.options.filter((o) => o.t === ans.t && o.p === ans.p).length, 1);
    // clues well-formed and the chart-side text never states the song title
    const clues = buildClues(ans, ans.y);
    assert.equal(clues.length, 5);
    clues.forEach((c) => assert.ok(c && !/undefined|NaN/.test(c)));
    assert.ok(!clues.slice(0, 3).some((c) => c.includes(ans.t)), 'title leaked in early clues');
    const txt = patternText(pz, ans, data);
    assert.ok(txt.length > 40 && !/undefined|NaN/.test(txt));
  }
  assert.ok(seen.size >= 60);
});
test('no leaks: nothing shown before the guess names the song or artist', () => {
  // the only pre-guess content is the numeric run, the year slider and fixed copy
  const src = JSON.stringify(game.meta);
  data.puzzles.slice(0, 50).forEach((pz) => { const a = data.options[pz.o]; assert.ok(a.t.length < 4 || !src.includes(a.t)); });
  data.puzzles.forEach((pz) => assert.ok(pz.run.every((x) => x === null || typeof x === 'number') && Object.keys(pz).sort().join() === 'o,run,start'));
});
