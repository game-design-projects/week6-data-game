import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import g, { survival, explain, findRow, anchorsFor, ANCHORS } from './game.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
// minimal stand-ins for the engine's seeded pick / rng (deterministic, day-indexed permutation)
const mk = (day) => ({
  data, day,
  pick: (arr) => arr[(day * 7919) % arr.length],
  rng: { chance: () => true },
});

test('survival', () => assert.equal(survival(90000, 45000), 50));

test('data sane', () => {
  assert.ok(Object.keys(data.countries).length > 150);
  assert.ok(data.rows.length >= 60);
  const seen = new Set();
  for (const r of data.rows) {
    const id = `${r.cc}|${r.s}|${r.y}`;
    assert.ok(!seen.has(id), `dup ${id}`); seen.add(id);
    assert.ok(data.countries[r.cc]?.iso2?.length === 2, `iso2 ${r.cc}`);
    assert.ok(['F', 'M'].includes(r.s) && data.years.includes(r.y));
    for (const k of ['p', 'e0', 'e40', 'u5', 's40']) assert.ok(Number.isFinite(r[k]), `${id} ${k}`);
    assert.ok(r.p > 1 && r.p < 95, `${id} p=${r.p}`);
    assert.ok(r.e0 > 25 && r.e0 < 95 && r.e40 > 15 && r.e40 < 55);
    assert.ok(r.u5 >= 0 && r.u5 < 500 && r.s40 > 30 && r.s40 <= 100);
  }
  // every (cc, year) has both sexes; anchors exist for every year
  for (const r of data.rows) assert.ok(findRow(data, r.cc, r.s === 'F' ? 'M' : 'F', r.y));
  for (const y of data.years) for (const s of ['F', 'M']) for (const k of [...ANCHORS, 'BRA']) assert.ok(findRow(data, k, s, y), `${k}${s}${y}`);
});

test('pool 1..120 valid, deterministic, no answer in clues', () => {
  for (let day = 1; day <= 120; day++) {
    const a = g.puzzle(mk(day));
    assert.deepEqual(a, g.puzzle(mk(day)));
    const r = findRow(data, a.cc, a.s, a.y);
    assert.ok(r, `day ${day}`);
    assert.ok(!anchorsFor(a.cc).includes(a.cc));
    assert.equal(anchorsFor(a.cc).length, 4);
    const txt = explain(r);
    assert.ok(txt.length > 20 && !/undefined|NaN/.test(txt));
  }
});

test('distinct days over 14', () => {
  const ids = new Set();
  for (let d = 1; d <= 14; d++) { const a = g.puzzle(mk(d)); ids.add(`${a.cc}${a.s}${a.y}`); }
  assert.ok(ids.size >= 7);
});

test('answers are spread so scoring can be earned and missed', () => {
  const ps = data.rows.map((r) => r.p).sort((a, b) => a - b);
  assert.ok(ps[Math.floor(ps.length * 0.1)] < 25 && ps[Math.floor(ps.length * 0.9)] > 60);
});
