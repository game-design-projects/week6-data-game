import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRng, dailyIndex, isoFromDay, expScore, logError } from '../../engine/core.js';
import game, { fmtHM, explain, eligible, findGroup, whoLabel, ACT, MIN_MEAN, SCALE } from './game.js';
import { SLEEP } from './acts.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const mk = (day) => game.puzzle({ data, day, date: isoFromDay(day), slug: 'time-use', rng: makeRng(`time-use:${isoFromDay(day)}`), pick: (arr) => arr[dailyIndex('time-use', day, arr.length)] });

test('fmtHM', () => { assert.equal(fmtHM(45), '45 分钟'); assert.equal(fmtHM(125), '2 小时 5 分'); assert.equal(fmtHM(720), '12 小时'); });

test('data: every cell is well-formed', () => {
  assert.ok(data.groups.length >= 300);
  const seen = new Set();
  for (const g of data.groups) {
    const key = `${g.y}|${g.s}|${g.a}`; assert.ok(!seen.has(key), `dup ${key}`); seen.add(key);
    assert.ok(g.y >= 2003 && g.y <= 2025); assert.ok([0, 1, 2].includes(g.s));
    assert.ok(g.v[SLEEP][0] >= 360 && g.v[SLEEP][0] <= 700, 'sleep range');
    for (const [k, c] of Object.entries(g.v)) {
      assert.equal(c.length, 3);
      assert.ok(c.every(Number.isFinite), `${key} ${k}`);
      assert.ok(c[0] >= 0 && c[0] <= 1000 && c[1] >= 0 && c[1] <= 100 && c[2] >= 1 && c[2] <= 1440, `${key} ${k} ${c}`);
      // mean over everyone ~= participation x mean among participants (rounding slack)
      if (c[0] >= MIN_MEAN) assert.ok(Math.abs(c[0] - c[1] * c[2] / 100) <= Math.max(6, c[0] * 0.25), `${key} ${k} ${c}`);
    }
  }
});

test('pool: days 1-120 give valid, well-formed puzzles', () => {
  const sigs = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = mk(day);
    assert.deepEqual(p, mk(day));
    const g = findGroup(data.groups, p);
    assert.ok(g, `day ${day} group`);
    assert.equal(p.acts.length, 3); assert.equal(new Set(p.acts).size, 3);
    for (const ac of p.acts) {
      assert.ok(ACT[ac] && ACT[ac][0] && ACT[ac][1], ac);
      assert.ok(g.v[ac][0] >= MIN_MEAN && g.v[ac][0] <= 720, `day ${day} ${ac} ${g.v[ac]}`);
    }
    assert.ok(!/undefined|NaN/.test(whoLabel(g)));
    for (const ac of p.acts) assert.ok(!/undefined|NaN/.test(explain(g.v[ac], null)));
    sigs.add(`${p.y}|${p.s}|${p.a}`);
  }
  assert.equal(sigs.size, 120, 'no repeated group in 120 days');
});

test('explain: low, high and middle participation, comparison to all adults', () => {
  assert.match(explain([3 * 2, 5, 120], null), /只有 5%/);
  assert.match(explain([120, 95, 126], null), /几乎一样/);
  assert.match(explain([40, 50, 80], [20, 50, 40]), /多约 100%/);
  assert.match(explain([10, 40, 25], [20, 50, 40]), /少约 50%/);
});

test('scoring: perfect / typical / worst', () => {
  const s = (guess, ans) => expScore(logError(guess, ans), SCALE);
  assert.equal(s(60, 60), 100);
  assert.ok(s(84, 60) >= 60 && s(84, 60) <= 63); // 1.4x
  assert.ok(s(120, 60) >= 36 && s(120, 60) <= 38); // 2x
  assert.ok(s(1, 720) <= 1 && s(720, 1) <= 1); // worst
});

test('skill: using the participation rate beats a fixed guess', () => {
  const score = (g, a) => expScore(logError(Math.max(1, g), a), SCALE);
  // informed guess: rate x typical time among those who did it (median of doer minutes across the pool, per activity)
  const med = {};
  for (const ac of Object.keys(ACT)) { const xs = data.groups.map((g) => g.v[ac]?.[2]).filter(Number.isFinite).sort((a, b) => a - b); med[ac] = xs[xs.length >> 1]; }
  let fixed = 0, informed = 0, n = 0;
  for (let day = 1; day <= 120; day++) {
    const p = mk(day); const g = findGroup(data.groups, p);
    for (const ac of p.acts) { const [m, r] = g.v[ac]; fixed += score(30, m); informed += score(r * med[ac] / 100, m); n++; }
  }
  console.log('avg fixed', (fixed / n).toFixed(1), 'informed', (informed / n).toFixed(1));
  assert.ok(informed / n > fixed / n + 15, 'informed play should clearly win');
  assert.ok(informed / n < 92, 'not trivial');
  assert.ok(fixed / n > 15, 'not hopeless');
});
