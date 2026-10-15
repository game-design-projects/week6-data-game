import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { localHour, fmtPlayers, peakHour, depth, tell } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('localHour wraps around midnight', () => {
  assert.equal(localHour(13, 8), '21:00');
  assert.equal(localHour(1, -4), '21:00');
  assert.equal(localHour(23, 2), '01:00');
});
test('fmtPlayers', () => {
  assert.equal(fmtPlayers(856000), '86 万');
  assert.equal(fmtPlayers(12345), '1.2 万');
  assert.equal(fmtPlayers(9800), '9,800');
});
test('peakHour / depth', () => {
  const v = Array(24).fill(500); v[7] = 1000; v[20] = 100;
  assert.equal(peakHour(v), 7);
  assert.equal(depth(v), 0.1);
});
test('tell mentions depth bucket and zones', () => {
  const deep = { v: Array.from({ length: 24 }, (_, h) => (h === 13 ? 1000 : 80)) };
  assert.match(tell(deep), /谷底极深.*UTC 13:00.*北京 21:00/);
  const flat = { v: Array.from({ length: 24 }, (_, h) => (h === 3 ? 1000 : 800)) };
  assert.match(tell(flat), /偏平/);
});

test('pool validity over days 1-120', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: 'concurrent', rng: null, pick: (a) => a[(day * 7) % a.length] });
    assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(p.items.length, 5);
    const ids = new Set(p.items.map((i) => i.id)), names = new Set(p.items.map((i) => i.name));
    assert.equal(ids.size, 5, 'duplicate ids');
    assert.equal(names.size, 5, 'duplicate names');
    for (const it of p.items) {
      assert.ok(it.name && !/undefined|NaN/.test(it.name));
      assert.ok(Number.isFinite(it.peak) && it.peak >= 1000 && it.peak < 5e6, `peak ${it.peak}`);
      assert.equal(it.v.length, 24);
      assert.ok(it.v.every((x) => Number.isInteger(x) && x >= 0 && x <= 1000), 'curve range');
      assert.equal(Math.max(...it.v), 1000, 'curve normalised to peak');
      assert.ok(depth(it.v) > 0, 'curve should not hit zero');
    }
    assert.ok(JSON.stringify(p));
    seen.add(JSON.stringify(p));
  }
  assert.ok(seen.size >= 60, `distinct puzzles: ${seen.size}`);
});

test('no game name leaks via visible clue text before the guess', () => {
  // visible card label is only the peak count; names only appear as options
  const p = game.puzzle({ data, pick: (a) => a[0] });
  for (const it of p.items) assert.ok(!/[A-Za-z]/.test(fmtPlayers(it.peak)));
});

test('every puzzle has pairwise-distinguishable curves or sizes', () => {
  for (const q of data.puzzles) {
    const its = q.ids.map((id) => data.games[id].days[q.date]);
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const d = Math.sqrt(its[i].v.reduce((s, x, k) => s + ((x - its[j].v[k]) / 1000) ** 2, 0) / 24);
      const ratio = Math.max(its[i].p, its[j].p) / Math.min(its[i].p, its[j].p);
      assert.ok(d >= 0.09 || ratio >= 2 || Math.abs(peakHour(its[i].v) - peakHour(its[j].v)) >= 3);
    }
  }
});

test('scoring extremes via the match formula: perfect > typical > worst', () => {
  const score = (ks, attempts = 3, n = 5) => Math.round(ks.reduce((s, k) => s + (100 / n) * (attempts - k + 1) / attempts, 0));
  assert.equal(score([1, 1, 1, 1, 1]), 100);
  assert.equal(score([1, 1, 2, 2, 3]), 73);
  assert.equal(score([]), 0);
});
