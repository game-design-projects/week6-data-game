import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { judge, grade, noteTimes, SPEED, explain, difficulty, gapsOf } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('judge windows', () => {
  assert.equal(judge(0.05), 100);
  assert.equal(judge(-0.1), 70);
  assert.equal(judge(0.2), 40);
  assert.equal(judge(0.4), 0);
});
test('noteTimes compresses minutes', () => {
  assert.deepEqual(noteTimes({ notes: [[60, 'A'], [120, 'C']] }), [SPEED, 2 * SPEED]);
});
test('grade perfect and stray', () => {
  const t = [1, 3, 5];
  assert.equal(grade(t, [1, 3, 5]).score, 100);
  assert.equal(grade(t, [1, 3, 5, 9]).score, 96);
  assert.equal(grade(t, []).score, 0);
});
test('a tap only matches one note', () => {
  const g = grade([1, 1.1], [1.05]);
  assert.equal(g.res.filter((r) => r.pts).length, 1);
});
test('scoring extremes over the pool', () => {
  for (const p of data.puzzles) {
    const t = noteTimes(p);
    assert.equal(grade(t, t).score, 100);
    const typical = grade(t, t.map((x, i) => x + (i % 2 ? 0.1 : -0.1))).score; // always 70
    assert.equal(typical, 70);
    const mash = []; for (let x = 0; x < t[t.length - 1] + 1; x += 0.1) mash.push(x);
    assert.ok(grade(t, mash).score < 25, 'mashing must not score well');
    assert.ok(grade(t, [t[0]]).score <= Math.ceil(100 / t.length));
  }
});
test('pool validity (days 1-120)', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, date: '', slug: 'headway', rng: null, pick: (a) => a[(day - 1) % a.length] });
    assert.ok(p.station && p.dir && p.head && p.service, 'text fields');
    for (const k of ['startSec', 'lat', 'lng', 'cv']) assert.ok(Number.isFinite(p[k]), k);
    assert.ok(p.lat > 40 && p.lat < 41 && p.lng > -75 && p.lng < -73);
    assert.ok(p.notes.length >= 8 && p.notes.length <= 20);
    let prev = null;
    for (const [s, r] of p.notes) {
      assert.ok(Number.isFinite(s) && s >= 0 && s <= 900, 'note time');
      if (prev != null) assert.ok(s - prev >= 45, 'gap >= 45 s'); prev = s;
      assert.match(r, /^[A-Z0-9]+( [A-Z0-9]+)*$/);
    }
    assert.ok(difficulty(p.cv));
    assert.ok(explain(p).length > 30 && !/undefined|NaN/.test(explain(p)));
    assert.ok(gapsOf(p).every((g) => g >= 0.75));
    seen.add(p.station + p.dir + p.startSec + p.service);
  }
  assert.ok(seen.size >= 60, `distinct puzzles ${seen.size}`);
});
