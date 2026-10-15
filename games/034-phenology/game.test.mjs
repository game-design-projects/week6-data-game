import test from 'node:test';
import assert from 'node:assert/strict';
import game, { weekDate, weekDist, weekScore } from './game.js';

test('weekDate maps weeks to calendar dates', () => {
  assert.deepEqual(weekDate(1), { m: 1, d: 1 });
  assert.deepEqual(weekDate(5), { m: 1, d: 29 });
  assert.equal(weekDate(52).m, 12);
});
test('weekDist wraps around the year', () => {
  assert.equal(weekDist(1, 52), 1);
  assert.equal(weekDist(10, 36), 26);
  assert.equal(weekDist(20, 20), 0);
});
test('weekScore: exact is 1, decays, symmetric across year end', () => {
  assert.equal(weekScore(30, 30), 1);
  assert.ok(weekScore(36, 30) < 0.4 && weekScore(36, 30) > 0.3);
  assert.equal(weekScore(2, 51), weekScore(51, 2));
});
test('puzzle is deterministic and keeps the answer among options', async () => {
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
  const mk = (seed) => { let s = seed; const rng = { shuffle: (a) => a.slice().reverse() }; return { data, rng, pick: (a) => a[s % a.length] }; };
  const a = game.puzzle(mk(3)), b = game.puzzle(mk(3));
  assert.deepEqual(a, b);
  assert.ok(a.o.includes(a.s));
  assert.equal(new Set(a.o).size, 5);
});

// ---- pool validity (days 1-120) ----
import { readFileSync } from 'node:fs';
import { makeRng, dailyIndex } from '../../engine/core.js';
import { seasonWidth } from './game.js';
const DATA = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const nm = (s) => s.en || s.sci;
const real = (day) => game.puzzle({ data: DATA, day, date: `d${day}`, slug: 'phenology', rng: makeRng(`phenology:${day}`), pick: (arr) => arr[dailyIndex('phenology', day, arr.length)] });

test('pool: every puzzle for days 1-120 is valid', () => {
  assert.ok(DATA.puzzles.length >= 60, `pool ${DATA.puzzles.length}`);
  for (let day = 1; day <= 120; day++) {
    const p = real(day);
    assert.ok(DATA.species[p.s], 'answer species exists');
    assert.equal(p.o.length, 5);
    assert.equal(new Set(p.o).size, 5, 'options distinct');
    assert.ok(p.o.includes(p.s), 'answer selectable');
    assert.equal(new Set(p.o.map((id) => nm(DATA.species[id]))).size, 5, 'option labels distinct');
    const ans = DATA.species[p.s];
    for (const id of p.o) {
      const s = DATA.species[id];
      assert.ok(s && nm(s) && s.sci && s.g === ans.g, 'option has name and same group');
      assert.ok(s.curves[p.a], 'option has curve in place A');
    }
    for (const cc of [p.a, p.b]) {
      const c = ans.curves[cc];
      assert.ok(c, `curve ${cc}`);
      assert.equal(c.c.length, 52);
      assert.ok(c.c.every((v) => Number.isFinite(v) && v >= 0 && v <= 100));
      assert.ok(c.peak >= 1 && c.peak <= 52 && c.c[c.peak - 1] === 100);
      assert.ok(c.n >= 250);
      assert.ok(DATA.places[cc]);
    }
    assert.notEqual(p.a, p.b);
    if (ans.photo) assert.ok(Number.isInteger(ans.photo.id) && ans.photo.id > 0);
  }
  const ids = DATA.puzzles.map((p) => `${p.s}-${p.a}-${p.b}`);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate puzzles');
});

test('pool: no answer leak in pre-guess text (names never appear in static copy)', () => {
  const copy = [game.meta.tagline, ...game.meta.howTo, game.meta.dataNote, game.meta.title].join('|');
  for (const s of Object.values(DATA.species)) {
    for (const n of [s.en, s.sci]) if (n && n.length > 2) assert.ok(!copy.includes(n), n);
  }
});

test('pool: distractor peaks differ from the answer in place A (guessable but not a tie)', () => {
  for (const p of DATA.puzzles) {
    const a = DATA.species[p.s].curves[p.a].peak;
    for (const o of p.o) assert.ok(weekDist(a, DATA.species[o].curves[p.a].peak) >= 3);
  }
});

test('stage 2 is not trivially solved by the naive rule on most puzzles', () => {
  const south = (c) => c === 'AU' || c === 'NZ';
  let hard = 0;
  for (const p of DATA.puzzles) {
    const A = DATA.species[p.s].curves[p.a].peak, B = DATA.species[p.s].curves[p.b].peak;
    const naive = south(p.a) !== south(p.b) ? A + 26 : A;
    if (weekDist(naive, B) >= 3) hard++;
  }
  assert.ok(hard / DATA.puzzles.length > 0.9);
});

test('scoring extremes: perfect 100, wrong+far near 0, typical in between', () => {
  const total = (stage1ok, g, a) => (stage1ok ? 33 : 0) + 67 * weekScore(g, a);
  assert.equal(total(true, 30, 30), 100);
  assert.ok(total(false, 4, 30) < 3);
  const typical = total(true, 33, 30);
  assert.ok(typical > 60 && typical < 90);
  assert.ok(seasonWidth([100, 50, 49]) === 2);
});
