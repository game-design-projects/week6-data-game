import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { corr, diffs, analyse, jaccard, LET, TARGET_MIN, DECOY_MAX } from './game.js';
import { makeRng } from '../../engine/core.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const puzzleFor = (day) => game.puzzle({ data, day, date: '', slug: 'spurious', rng: makeRng?.(day), pick: (arr) => arr[(day - 1) % arr.length] });

test('corr basics', () => { assert.ok(Math.abs(corr([1, 2, 3], [2, 4, 6]) - 1) < 1e-9); assert.ok(corr([1, 2, 3], [3, 2, 1]) < -0.99); assert.deepEqual(diffs([1, 3, 6]), [2, 3]); });

test('every set: exactly one pair r>0.9 and it matches t; decoys < 0.8', () => {
  for (const s of data.sets) {
    const v = s.s.map((k) => data.lib[k]);
    const hi = [];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) { const r = corr(v[i], v[j]); if (r > TARGET_MIN) hi.push([i, j]); else assert.ok(r < DECOY_MAX, `decoy r ${r}`); }
    assert.deepEqual(hi, [s.t]);
  }
});

test('days 1-120: every puzzle valid', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = puzzleFor(day);
    assert.equal(p.rounds.length, 3);
    assert.equal(new Set(p.rounds).size, 3, 'distinct sets in a day');
    for (const idx of p.rounds) {
      const set = data.sets[idx];
      assert.ok(set, `set ${idx}`);
      assert.equal(set.s.length, 6);
      assert.equal(new Set(set.s).size, 6, 'duplicate series');
      assert.equal(new Set(set.s.map((k) => k.split('|')[1])).size, 6, 'duplicate country');
      assert.equal(new Set(set.s.map((k) => k.split('|')[0])).size, 6, 'duplicate indicator');
      assert.ok(set.t.length === 2 && set.t[0] < set.t[1] && set.t.every((i) => i >= 0 && i < 6));
      for (const k of set.s) {
        const [ind, cc] = k.split('|');
        assert.ok(data.ind[ind], `ind ${ind}`);
        assert.ok(data.countries[cc]?.z && data.countries[cc]?.n, `country ${cc}`);
        const v = data.lib[k];
        assert.equal(v.length, 23);
        assert.ok(v.every((x) => Number.isFinite(x)), `NaN in ${k}`);
        assert.ok(new Set(v).size >= 12, `flat ${k}`);
      }
      const a = analyse(data, set);
      assert.ok(Number.isFinite(a.r) && Number.isFinite(a.rd) && a.near.r < DECOY_MAX);
      seen.add(idx);
    }
  }
  assert.ok(seen.size >= 200, `pool coverage ${seen.size}`);
});

test('pool has >= 60 distinct daily puzzles and every set used once', () => {
  assert.ok(data.puzzles.length >= 60);
  const all = data.puzzles.flat();
  assert.equal(new Set(all).size, all.length);
});

test('target pair is not trivially "the two rising lines": >= 2 decoys trend like the target', () => {
  for (const s of data.sets) {
    const a = analyse(data, s), sign = Math.sign(a.trend[s.t[0]]);
    const look = a.trend.filter((t, i) => !s.t.includes(i) && Math.sign(t) === sign && Math.abs(t) > 0.6).length;
    assert.ok(look >= 2, `look-alikes ${look}`);
  }
});

test('no answer leak: no name text in puzzle() output', () => {
  const j = JSON.stringify(puzzleFor(15));
  assert.ok(!/[A-Za-z]{4,}/.test(j.replace(/rounds/, '')));
});

test('scoring extremes (Jaccard)', () => {
  assert.equal(jaccard([1, 2], [1, 2]), 1);
  assert.ok(Math.abs(jaccard([1, 3], [1, 2]) - 1 / 3) < 1e-9);
  assert.equal(jaccard([3, 4], [1, 2]), 0);
  let sum = 0, n = 0;
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) { sum += jaccard([i, j], [0, 1]); n++; }
  assert.ok(sum / n < 0.3, 'random guessing is weak');
});
