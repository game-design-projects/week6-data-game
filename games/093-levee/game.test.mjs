import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { N, leveeCells, simulate, dryCount, scoreOf, greedy, refine, candidates, cellCounts, marginals } from './sim.js';
import game, { toPuzzle } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('levee cells are clamped inside the grid', () => {
  assert.equal(leveeCells({ r: 3, c: 0, o: 'h' }).length, 5);
  assert.ok(leveeCells({ r: 3, c: 0, o: 'h' }).every((i) => i >= 3 * N && i < 4 * N));
  assert.ok(leveeCells({ r: 15, c: 4, o: 'v' }).every((i) => i % N === 4));
});

test('candidates are distinct cell sets', () => {
  const keys = new Set(candidates().map((lv) => leveeCells(lv).join()));
  assert.equal(keys.size, candidates().length);
  assert.equal(keys.size, 2 * N * (N - 5 + 1));
});

test('flat terrain, small rain stays below wet threshold', () => {
  const d = simulate(new Array(N * N).fill(0), 0.1);
  assert.ok(Math.max(...d) <= 0.11);
});

test('a bowl floods its centre; greedy/refine never do worse than nothing', () => {
  const z = Array.from({ length: N * N }, (_, i) => Math.hypot(Math.floor(i / N) - 7.5, (i % N) - 7.5) * 0.8);
  const b = new Array(N * N).fill(0); b[7 * N + 7] = 10; b[0] = 5;
  const d = simulate(z, 1.5);
  assert.ok(d[7 * N + 7] > 0.3);
  const g = greedy(z, b, 1.5, 2);
  assert.ok(g.dry >= dryCount(b, d));
  assert.ok(refine(z, b, 1.5, g.levees, 1).dry >= g.dry);
});

test('simulation is deterministic', () => {
  const z = Array.from({ length: N * N }, (_, i) => (i * 7) % 5);
  assert.deepEqual([...simulate(z, 1)], [...simulate(z, 1)]);
});

test('scoreOf: perfect, typical and worst', () => {
  assert.equal(scoreOf(10, 30, 20), 50);
  assert.equal(scoreOf(10, 30, 30), 100);
  assert.equal(scoreOf(10, 30, 40), 100);
  assert.equal(scoreOf(10, 30, 10), 0);
  assert.equal(scoreOf(10, 30, 5), 0);
});

test('cellCounts bins points by tenths of a cell', () => {
  const b = cellCounts([0, 0, 9, 9, 10, 0, 159, 159, 160, 160]);
  assert.equal(b[0], 2); assert.equal(b[1], 1); assert.equal(b[N * N - 1], 2);
});

test('pool: every puzzle over days 1-120 is valid', () => {
  assert.ok(data.sites.length >= 60, 'pool size');
  const names = new Set();
  for (const s of data.sites) { assert.ok(!names.has(s.name), 'dup ' + s.name); names.add(s.name); }
  for (let day = 1; day <= 120; day++) {
    const rng = { int: () => 0 };
    const pk = (arr) => arr[(day * 7) % arr.length];
    const p = game.puzzle({ data, day, pick: pk, rng });
    const w = `${p.name}`;
    assert.ok(p.name && /\S/.test(p.name), w);
    assert.ok(p.lat > 18 && p.lat < 72 && p.lng < -66 && p.lng > -170, w + ' coords');
    assert.ok(p.rain > 0 && p.rain <= 10, w + ' rain');
    assert.equal(p.z.length, N * N, w); assert.ok(p.z.every((v) => Number.isFinite(v) && v >= 0 && v < 3000), w + ' z');
    assert.ok(p.pts.length % 2 === 0 && p.pts.length >= 80, w + ' pts');
    assert.ok(p.pts.every((v) => Number.isInteger(v) && v >= 0 && v < N * 10), w + ' pts range');
    assert.equal(p.b.reduce((a, x) => a + x, 0), p.pts.length / 2);
    assert.ok(p.ref.length >= 1 && p.ref.length <= 3, w + ' ref');
    for (const lv of p.ref) assert.ok(lv.r >= 0 && lv.r < N && lv.c >= 0 && lv.c < N && (lv.o === 'h' || lv.o === 'v'), w + ' ref lv');
    const nb = p.pts.length / 2;
    const base = dryCount(p.b, simulate(p.z, p.rain));
    const ref = dryCount(p.b, simulate(p.z, p.rain, p.ref));
    assert.ok(base / nb > 0.1 && base / nb < 0.9, `${w} base share ${base / nb}`);
    assert.ok(ref - base >= 8 && ref - base >= 0.05 * nb, `${w} gain ${ref - base}`);
    assert.equal(scoreOf(base, ref, ref), 100); assert.equal(scoreOf(base, ref, base), 0);
    // name must not leak anything: puzzle has no answer field other than the reference solution
    assert.equal(JSON.stringify(Object.keys(p).sort()), JSON.stringify(['b', 'lat', 'lng', 'name', 'pts', 'rain', 'ref', 'z']));
  }
});

test('scoring is neither trivial nor impossible (sampled sites)', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const sample = data.sites.filter((_, i) => i % 6 === 0);
  let randSum = 0, n = 0;
  for (const s of sample) {
    const p = toPuzzle(s);
    const base = dryCount(p.b, simulate(p.z, p.rain)), ref = dryCount(p.b, simulate(p.z, p.rain, p.ref));
    for (let t = 0; t < 6; t++) {
      const lv = [0, 1, 2].map(() => ({ r: Math.floor(rnd() * N), c: Math.floor(rnd() * N), o: rnd() < 0.5 ? 'h' : 'v' }));
      randSum += scoreOf(base, ref, dryCount(p.b, simulate(p.z, p.rain, lv))); n++;
    }
    // first reference levee alone is a decent but incomplete answer
    const one = scoreOf(base, ref, dryCount(p.b, simulate(p.z, p.rain, p.ref.slice(0, 1))));
    assert.ok(one < 100 && one >= 0);
    assert.equal(marginals(p.z, p.b, p.rain, p.ref).length, p.ref.length);
  }
  const avg = randSum / n;
  assert.ok(avg < 25, 'random play should score low, got ' + avg);
});

test('every site name is plain text without redaction or html', () => {
  for (const s of data.sites) assert.match(s.name, /^[A-Za-z .'-]+ [A-Z]{2}$/);
});
