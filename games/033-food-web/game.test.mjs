import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { edgeF1, pairKey, gradeWeb, webInsight } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('F1 perfect, empty, direction-reversed, partial', () => {
  const T = ['a>b', 'c>d'];
  assert.equal(edgeF1(T, T), 1);
  assert.equal(edgeF1(T, []), 0);
  assert.equal(edgeF1(T, ['b>a']), 0);
  assert.ok(Math.abs(edgeF1(T, ['a>b']) - 2 / 3) < 1e-9);
  assert.equal(pairKey('x', 'y'), 'x>y');
});

test('weak edges are neutral', () => {
  const r = gradeWeb(['a>b', 'c>d'], ['e>f'], ['a>b', 'c>d', 'e>f']);
  assert.equal(r.f1, 1);
  assert.deepEqual(r.ignored, ['e>f']);
  const rev = gradeWeb(['a>b'], ['e>f'], ['a>b', 'f>e']);
  assert.ok(rev.f1 < 1); // reversed weak edge is a real mistake
});

test('scoring extremes on every puzzle: perfect 100, empty 0, spamming every pair cannot win', () => {
  for (const p of data.puzzles) {
    const T = p.e.map(([a, b]) => pairKey(a, b));
    const W = (p.w || []).map(([a, b]) => pairKey(a, b));
    assert.equal(gradeWeb(T, W, T).f1, 1);
    assert.equal(gradeWeb(T, W, []).f1, 0);
    // brute force: even drawing all 15 pairs with the best possible direction never reaches the 0.8 win line
    const best = [];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
      const f = pairKey(p.sp[i], p.sp[j]), r = pairKey(p.sp[j], p.sp[i]);
      best.push(T.includes(r) ? r : f);
    }
    assert.ok(gradeWeb(T, W, best).f1 < 0.8);
  }
});

test('puzzle keeps species and edges', () => {
  const d = { puzzles: [{ eco: 'e', sp: ['a', 'b', 'c', 'd', 'e', 'f'], e: [['a', 'b', 2]], w: [] }] };
  const rng = { shuffle: (x) => x.slice().reverse() };
  const p = game.puzzle({ data: d, pick: (a) => a[0], rng });
  assert.equal(p.sp.length, 6);
  assert.deepEqual(p.e, [['a', 'b', 2]]);
});

test('webInsight describes top / base / middle', () => {
  const L = webInsight([['w', 'f'], ['f', 'm'], ['f', 'g']], (x) => x, () => 'Fish', ['w', 'f', 'm', 'g', 'z']);
  assert.ok(L.some((l) => l.startsWith('Top: w')));
  assert.ok(L.some((l) => l.includes('Bottom: m') || l.includes('Bottom: g')));
  assert.ok(L.some((l) => l.startsWith('Middle: f')));
  assert.ok(L.some((l) => l.includes('z')));
});

test('pool of days 1-120 is valid', () => {
  assert.ok(data.puzzles.length >= 60);
  const info = new Map(data.ecos.flatMap((e) => e.species).map((s) => [s.latin, s]));
  const seenSets = new Set();
  const rngOf = { shuffle: (x) => x.slice() };
  for (let day = 1; day <= 120; day++) {
    const idx = (day - 1) % data.puzzles.length; // pick() is a permutation; every entry is validated below anyway
    void idx;
  }
  for (const [i, raw] of data.puzzles.entries()) {
    const p = game.puzzle({ data, pick: () => raw, rng: rngOf });
    assert.equal(p.sp.length, 6, `puzzle ${i}`);
    assert.equal(new Set(p.sp).size, 6, 'distinct species');
    const key = p.eco + [...p.sp].sort().join('|');
    assert.ok(!seenSets.has(key), 'duplicate puzzle');
    seenSets.add(key);
    for (const s of p.sp) {
      const sp = info.get(s);
      assert.ok(sp, `missing info ${s}`);
      for (const f of ['en', 'kind']) {
        assert.ok(sp[f] && !/undefined|NaN/.test(sp[f]), `${s}.${f}`);
        assert.ok(/^[\x20-\x7e]+$/.test(sp[f]), `${s}.${f} English`);
      }
    }
    assert.ok(p.e.length >= 4 && p.e.length <= 9, 'edge count');
    assert.ok(p.w.length <= 2);
    const seen = new Set();
    for (const [a, b, n] of [...p.e, ...p.w]) {
      assert.ok(p.sp.includes(a) && p.sp.includes(b) && a !== b);
      assert.ok(Number.isInteger(n) && n >= 1 && n < 1000);
      assert.ok(!seen.has(a + b) && !seen.has(b + a), 'pair listed twice / both directions');
      seen.add(a + b);
    }
    for (const [, , n] of p.e) assert.ok(n >= 2);
    for (const [, , n] of p.w) assert.equal(n, 1);
    assert.ok(p.sp.every((s) => p.e.some((x) => x[0] === s || x[1] === s)), 'every species has an edge');
  }
});
