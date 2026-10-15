import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { posterior, visibleAnswers, clueLifts, lookalikes, clueTexts } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('visibleAnswers grows then caps at 5', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 8].map(visibleAnswers), [2, 3, 4, 5, 5, 5]);
});
test('posterior sums to 1 and favours the source state', () => {
  const p = data.puzzles[0];
  const post = posterior(data, p.clues);
  assert.ok(Math.abs(Object.values(post).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(post[p.st] > 1 / 48);
});
test('every puzzle references real questions/options and rank <= 6', () => {
  for (const p of data.puzzles) {
    assert.equal(p.clues.length, 5);
    assert.ok(p.rank <= 4);
    for (const [q, k] of p.clues) assert.ok(data.questions[q].opts[k]);
  }
});
test('puzzle() is deterministic', () => {
  const mk = () => game.puzzle({ data, pick: (a) => a[3] });
  assert.deepEqual(mk(), mk());
});

test('pool: puzzle() over days 1-120 is valid and leak-free', () => {
  const S = data.states;
  const names = Object.values(S).map((s) => s.en.toLowerCase());
  const cities = ['boston', 'chicago', 'new york', 'philadelphia', 'texas', 'minnesota'];
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const pick = (a) => a[(day * 7919) % a.length];
    const p = game.puzzle({ data, day, pick });
    assert.ok(S[p.st], 'answer is a selectable option');
    assert.equal(p.clues.length, 5);
    assert.equal(new Set(p.clues.map(([q]) => q)).size, 5, 'distinct questions');
    assert.ok(p.rank >= 1 && p.rank <= 4);
    seen.add(JSON.stringify(p));
    for (const [q, k] of p.clues) {
      const o = data.questions[q]?.opts[k];
      assert.ok(o && o.t && data.questions[q].zh, 'option+prompt exist');
      assert.ok(o.p[p.st] >= 12 && Number.isFinite(o.nat) && o.nat > 0);
    }
    for (const t of clueTexts(data, p).map((x) => x.toLowerCase())) {
      for (const n of [...names, ...cities]) assert.ok(!t.includes(n), `leak "${n}" in "${t}"`);
      assert.ok(!/undefined|nan|null/.test(t));
    }
  }
  assert.ok(seen.size >= 60, `pool size ${seen.size}`);
  for (const [c, s] of Object.entries(S)) {
    assert.ok(s.zh && s.en && Number.isFinite(s.lat) && Number.isFinite(s.lng) && ['NE', 'S', 'MW', 'W'].includes(s.reg), c);
    assert.ok(s.lat > 24 && s.lat < 50 && s.lng < -66 && s.lng > -125, c);
  }
});
test('clueLifts and lookalikes', () => {
  const p = data.puzzles[0];
  const l = clueLifts(data, p.st, p.clues);
  assert.equal(l.length, 5);
  assert.ok(l.every((x) => x.lift >= 1.7 - 1e-9));
  const like = lookalikes(data, p.clues, p.st, 2);
  assert.equal(like.length, 2);
  assert.ok(like.every(([c]) => c !== p.st));
});
test('scoring extremes: 100 at first try, 17 at sixth, strictly decreasing', () => {
  const sc = (n) => Math.round(100 * (6 - n + 1) / 6);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(sc), [100, 83, 67, 50, 33, 17]);
});
test('a perfect-information guesser (argmax posterior) wins in <= 6 tries on every puzzle', () => {
  for (const p of data.puzzles) {
    const order = Object.entries(posterior(data, p.clues)).sort((a, b) => b[1] - a[1]).map(([c]) => c);
    assert.ok(order.indexOf(p.st) < 6, p.st);
  }
});
