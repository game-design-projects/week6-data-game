import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { optimalCells, scoreRun, TARGET } from './game.js';
import { makeRng, pickForDay } from './test-helpers.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('optimalCells takes densest first and stops at 95% of target', () => {
  const cells = [500000, 300000, 200000, 100000, 10, 0];
  const o = optimalCells(cells);
  assert.equal(o.k, 3);
  assert.deepEqual(o.idx, [0, 1, 2]);
  assert.equal(optimalCells([600000, 400000, 1]).k, 2);
  assert.equal(optimalCells([960000, 5]).k, 1);
});

test('scoreRun: efficiency^2 x accuracy, extremes', () => {
  assert.equal(scoreRun(1_000_000, 10, 10), 100); // perfect
  assert.equal(scoreRun(1_040_000, 20, 10), 25); // twice the cells
  assert.equal(scoreRun(1_000_000, 11, 10), 83); // 10% too many cells
  assert.equal(scoreRun(1_175_000, 10, 10), 50); // 17.5% off => acc .5
  assert.equal(scoreRun(1_400_000, 10, 10), 0);
  assert.equal(scoreRun(0, 0, 10), 0);
  assert.equal(scoreRun(1_000_000, 5, 10), 100); // capped
  assert.ok(scoreRun(data.puzzles[0].total, 900, 50) < 1); // paint everything: ~0
});

function checkAll(label, build) {
  const ids = new Set();
  for (const [day, p] of build()) {
    for (const k of ['iso', 'country', 'place', 'lat', 'lng', 'km2', 'total']) assert.ok(p[k] !== undefined && p[k] !== null && p[k] !== '' && !Number.isNaN(p[k]), `${day} ${k}`);
    assert.equal(p.n, 30);
    assert.equal(p.cells.length, 900);
    assert.ok(p.cells.every((v) => Number.isInteger(v) && v >= 0 && v < 200000), `${day} cells`);
    assert.equal(p.cells.reduce((a, b) => a + b, 0), p.total);
    assert.ok(p.total >= 1.6e6 && p.total <= 8e6, `${day} total ${p.total}`);
    assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
    assert.ok(p.km2 > 0.2 && p.km2 < 1.2);
    assert.ok(p.optK >= 5 && p.optK <= 450, `${day} optK ${p.optK}`);
    assert.ok(p.optSum >= TARGET * 0.95 && p.optSum <= TARGET * 1.05, `${day} optSum ${p.optSum}`);
    assert.equal(new Set(p.optIdx).size, p.optK);
    assert.ok(p.cells.filter((v) => v < 1).length < 900 * 0.45, `${day} too empty`);
    ids.add(`${p.iso}@${p.lat},${p.lng}`);
  }
  return ids;
}
const run = (day, pick) => game.puzzle({ data, day, date: '2026-10-01', slug: 'paint-a-million', rng: makeRng(day), pick });

test('pool: every puzzle served over days 1-120 is well-formed and solvable', () => {
  const ids = checkAll('days', function* () { for (let d = 1; d <= 120; d++) yield [d, run(d, (a) => pickForDay(a, d))]; });
  assert.ok(ids.size >= 60, `distinct windows ${ids.size}`);
});

test('pool: every entry in data.json is well-formed and solvable', () => {
  const ids = checkAll('all', function* () { for (let i = 0; i < data.puzzles.length; i++) yield [i, run(i, (a) => a[i])]; });
  assert.equal(ids.size, data.puzzles.length);
});

test('pool: no duplicate windows, no answer text in labels', () => {
  const seen = new Set();
  for (const p of data.puzzles) {
    const key = `${p.iso}@${p.lat},${p.lng}`;
    assert.ok(!seen.has(key), key); seen.add(key);
    assert.ok(typeof p.place === 'string' && !/undefined|null|NaN/.test(p.place + p.country));
  }
});
