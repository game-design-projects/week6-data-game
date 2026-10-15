import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mulberry, surrogate, METHODS, norm100, diff, mean, std } from './build/synth.mjs';
import game, { layout, stats, giveaway, ROUNDS, TELLS } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const byId = new Map(data.puzzles.map((p) => [p.id, p]));

test('surrogates keep length and start, are deterministic', () => {
  const x = Array.from({ length: 72 }, (_, i) => Math.sin(i / 5) + i * 0.02);
  for (const m of Object.keys(METHODS)) {
    const a = surrogate(m, x, mulberry(1)), b = surrogate(m, x, mulberry(1));
    assert.equal(a.length, 72); assert.equal(a[0], x[0]); assert.deepEqual(a, b);
  }
});
test('shuffle surrogate preserves step distribution', () => {
  const x = Array.from({ length: 72 }, (_, i) => Math.sin(i / 3) * i);
  const y = surrogate('shuffle', x, mulberry(2));
  assert.ok(Math.abs(mean(diff(x)) - mean(diff(y))) < 1e-9);
  assert.ok(Math.abs(std(diff(x)) - std(diff(y))) < 1e-9);
});
test('norm100 spans 0..100', () => { const n = norm100([3, 5, 9]); assert.equal(n[0], 0); assert.equal(n[2], 100); });

test('pool validity', () => {
  assert.ok(data.puzzles.length >= 60 && data.puzzles.length % ROUNDS === 0);
  const ids = new Set();
  for (const p of data.puzzles) {
    assert.ok(!ids.has(p.id), 'dup id'); ids.add(p.id);
    assert.ok(data.series[p.s], 'series ' + p.s);
    assert.match(p.from, /^\d{4}-\d{2}$/); assert.match(p.to, /^\d{4}-\d{2}$/); assert.ok(p.from < p.to);
    assert.equal(p.decoys.length, 3);
    assert.equal(new Set(p.decoys.map((d) => d.m)).size, 3, 'distinct methods');
    for (const d of p.decoys) assert.ok(data.methods[d.m] && TELLS[d.m]);
    const curves = [p.real, ...p.decoys.map((d) => d.v)];
    for (const v of curves) {
      assert.equal(v.length, data.window);
      assert.ok(v.every((y) => Number.isFinite(y) && y >= 0 && y <= 100));
      assert.equal(Math.min(...v), 0); assert.equal(Math.max(...v), 100);
    }
    // decoys must differ from the real curve and from each other
    const keys = curves.map((v) => v.join());
    assert.equal(new Set(keys).size, 4, 'identical curves');
  }
  for (const s of Object.values(data.series)) for (const k of ['name', 'unit', 'src']) assert.ok(s[k]);
});

test('no answer leaks in what is visible before guessing: curves carry no extra marks', () => {
  // the only visible data pre-guess is the 0–100 y values; check real is not systematically distinguishable by range/endpoints
  let realEndHigh = 0;
  for (const p of data.puzzles) { if (p.real[71] > 50) realEndHigh++; }
  assert.ok(realEndHigh / data.puzzles.length > 0.3 && realEndHigh / data.puzzles.length < 0.85);
  // decoy exact copies of real prefix would leak: first value of curves must not all be unique to real
  const startsReal = data.puzzles.filter((p) => p.decoys.every((d) => d.v[0] !== p.real[0])).length;
  assert.ok(startsReal < data.puzzles.length); // normalisation can coincide; real is not special
});

test('layout puts real at correct index and spreads positions', () => {
  const rng = { shuffle: (a) => a.slice().reverse() };
  const l = layout(data.puzzles[0], rng);
  assert.equal(l.order[l.correct].real, true);
  const pos = [0, 0, 0, 0];
  for (let i = 0; i < 400; i++) { const r = mulberry(i); const rg = { shuffle: (a) => { const o = a.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; } }; pos[layout(data.puzzles[0], rg).correct]++; }
  assert.ok(pos.every((n) => n > 60));
});

test('puzzle: 5 distinct ids from 5 distinct series, days 1–120 deterministic', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const a = game.puzzle({ data, day }), b = game.puzzle({ data, day });
    assert.deepEqual(a, b);
    assert.equal(a.ids.length, ROUNDS); assert.equal(new Set(a.ids).size, ROUNDS);
    assert.equal(new Set(a.ids.map((i) => byId.get(i).s)).size, ROUNDS, 'series repeat in day ' + day);
    for (const i of a.ids) assert.ok(byId.has(i));
    if (day <= 60) a.ids.forEach((i) => { assert.ok(!seen.has(i), 'repeat within 60 days'); seen.add(i); });
  }
  assert.notDeepEqual(game.puzzle({ data, day: 14 }), game.puzzle({ data, day: 15 }));
});

test('giveaway text is specific and finite for every puzzle', () => {
  for (const p of data.puzzles) {
    const g = giveaway(p);
    assert.ok(Number.isFinite(g.dev) && g.fakes.length === 3);
    assert.ok(!/NaN|undefined|Infinity/.test(g.text), g.text);
  }
  const s = stats([0, 10, 20, 30, 100, 90]);
  assert.equal(s.jump, 70);
});

test('scoring extremes: random guessing expectation vs perfect', () => {
  assert.equal(0.25 * ROUNDS, 1.25);
  // P(>=3 of 5 by pure guess) is small
  const C = (n, k) => [...Array(k).keys()].reduce((a, i) => (a * (n - i)) / (i + 1), 1);
  let p3 = 0; for (let k = 3; k <= 5; k++) p3 += C(5, k) * 0.25 ** k * 0.75 ** (5 - k);
  assert.ok(p3 < 0.11);
});
