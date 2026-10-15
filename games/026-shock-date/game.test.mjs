import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { rebase, dayScore, explain } from './game.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const pickFor = (day) => (arr) => arr[(day * 7 + 3) % arr.length];

test('dayScore: perfect, typical, worst', () => {
  assert.equal(dayScore(10, 10), 100);
  assert.ok(dayScore(13, 10) > 30 && dayScore(13, 10) < 40);
  assert.ok(dayScore(11, 10) > 70 && dayScore(11, 10) < 75);
  assert.ok(dayScore(1, 50) < 1);
  assert.ok(dayScore(25, 25) > dayScore(26, 25) && dayScore(26, 25) > dayScore(28, 25)); // monotone
  // a flat "always guess the middle" strategy cannot score well across the pool
  const avg = data.puzzles.reduce((s, p) => s + dayScore(25, p.ans), 0) / data.puzzles.length;
  assert.ok(avg < 20, `middle-guess average ${avg}`);
});

test('rebase', () => {
  assert.deepEqual(rebase({ kind: 'pct', base: 50, v: [50, 100] }), [100, 200]);
  assert.deepEqual(rebase({ kind: 'diff', base: 2, v: [2, 2.5] }), [0, 0.5]);
});

test('pool: >= 60 distinct events, answer positions vary', () => {
  assert.ok(data.puzzles.length >= 60);
  assert.equal(new Set(data.puzzles.map((p) => p.ev)).size, data.puzzles.length);
  const ans = data.puzzles.map((p) => p.ans);
  assert.ok(new Set(ans).size >= 25, 'answer day must not be a fixed position');
  assert.ok(Math.min(...ans) >= 5 && Math.max(...ans) <= 45);
});

test('every puzzle for days 1-120 is valid and leak free', () => {
  const dateRe = /\d{4}-\d{2}-\d{2}/;
  for (let day = 1; day <= 120; day++) {
    const a = game.puzzle({ data, day, pick: pickFor(day) });
    assert.deepEqual(a, game.puzzle({ data, day, pick: pickFor(day) }));
    const { pz, ev } = a;
    assert.equal(pz.series.length, 4);
    assert.equal(new Set(pz.series.map((s) => s.id)).size, 4, 'distinct series');
    assert.ok(Number.isInteger(pz.ans) && pz.ans >= 1 && pz.ans <= pz.n);
    assert.ok(ev.label && ev.why && /^\d{4}-\d{2}-\d{2}$/.test(ev.date));
    assert.ok(pz.from <= ev.date && ev.date <= pz.to);
    for (const s of pz.series) {
      assert.equal(s.v.length, pz.n);
      assert.ok(s.name && ['pct', 'diff'].includes(s.kind) && s.move);
      assert.ok(Number.isFinite(s.base) && s.base !== 0 && Number.isFinite(s.z) && s.z > 0 && s.z < 100);
      assert.ok(s.v.every((x) => Number.isFinite(x)));
      if (s.kind === 'pct') assert.ok(s.v.every((x) => x > 0) && rebase(s).every((x) => x > 5 && x < 1000));
      // nothing the player sees before guessing may contain a date or the event wording
      assert.ok(!dateRe.test(s.name) && !s.name.includes(ev.label));
    }
    // the answer day really is a jump: max |day-to-day move| of the strongest series sits on the answer day or next to it
    assert.ok(explain(pz).includes(`第 ${pz.ans} 天`));
  }
});

test('shock day is a real jump in the stored series', () => {
  for (const p of data.puzzles) {
    const jump = (s, i) => Math.abs(s.kind === 'pct' ? s.v[i] / s.v[i - 1] - 1 : s.v[i] - s.v[i - 1]);
    const top = [...p.series].sort((a, b) => b.z - a.z)[0];
    const all = top.v.slice(1).map((_, i) => jump(top, i + 1)).sort((a, b) => a - b);
    const median = all[Math.floor(all.length / 2)];
    assert.ok(jump(top, p.ans - 1) >= 2 * median, `${p.from}: answer-day jump vs median`);
  }
});
test('every pool entry is reachable and well formed', () => {
  for (const p of data.puzzles) {
    const { pz, ev } = game.puzzle({ data, day: 1, pick: () => p });
    assert.equal(pz, p);
    assert.ok(ev.label.length > 3 && ev.why.length > 10);
  }
});
