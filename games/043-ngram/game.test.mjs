import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { cosine, pearson, semState, trendText, shapeFacts, whyText } from './lib.js';
import game from './game.js';
const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const mkRng = (seed) => { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32; };
test('cosine/pearson', () => {
  assert.ok(Math.abs(cosine([1, 0], [1, 0]) - 1) < 1e-9);
  assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-9);
  assert.ok(Math.abs(pearson([1, 2, 3], [2, 4, 6]) - 1) < 1e-9);
  assert.ok(Math.abs(pearson([1, 2, 3], [3, 2, 1]) + 1) < 1e-9);
});
test('states and text', () => {
  assert.equal(semState(1), 'hit'); assert.equal(semState(0.7), 'near'); assert.equal(semState(0.2), undefined);
  assert.match(trendText({ peak: 1950, last: 0.05 }), /1950/);
});
test('shape facts: new word vs old word vs double peak', () => {
  const yr = (fn) => Array.from({ length: 220 }, (_, i) => fn(1800 + i));
  const nw = { f: yr((y) => (y < 1900 ? -7 : -7 + Math.min(3, (y - 1900) / 20))), range: 3 };
  const s = shapeFacts(nw); assert.ok(s.rise >= 1900 && s.rise < 1990); assert.equal(s.riseFromStart, false); assert.ok(s.lastRatio > 0.9);
  const old = { f: yr((y) => -5 - Math.abs(y - 1850) / 100), range: 2.2 };
  assert.equal(shapeFacts(old).riseFromStart, true); assert.match(whyText(old), /1850/);
  const dbl = { f: yr((y) => -6 + Math.exp(-(((y - 1860) / 15) ** 2)) * 2 + Math.exp(-(((y - 1945) / 12) ** 2)) * 1.8), range: 2 };
  assert.ok(shapeFacts(dbl).second, 'double peak detected');
});
test('pool validity over days 1-120', () => {
  assert.ok(game.meta.num === 43 && d.step === 1 && d.y0 === 1800);
  assert.ok(d.answers.length >= 60);
  const words = new Set(), seen = new Set();
  d.items.forEach((x, i) => {
    assert.ok(!words.has(x.w), 'dup word ' + x.w); words.add(x.w);
    assert.match(x.w, /^[a-z]+$/); assert.equal(x.f.length, 220); assert.equal(x.v.length, 50);
    assert.ok(x.f.every((v) => Number.isFinite(v) && v > -15 && v < 0), x.w);
    assert.ok(x.peak >= 1800 && x.peak <= 2019 && x.range >= 0 && x.range < 8 && x.last > 0 && x.last <= 1, x.w);
    assert.equal(x.nn.length, 4, x.w);
  });
  for (let day = 1; day <= 120; day++) {
    const pick = (arr) => arr[(day * 7 + 3) % arr.length];
    const p = game.puzzle({ data: d, day, date: '2026-10-01', slug: 'ngram', rng: { int: () => 0 }, pick });
    const a = d.items[p.i]; assert.ok(a && d.answers.includes(p.i) && a.range >= 1.3 && a.w.length >= 4);
    seen.add(a.w);
    assert.ok(whyText(a).length > 20 && !/NaN|undefined/.test(whyText(a)), a.w);
  }
  assert.ok(seen.size >= 60);
});
test('answer leaks in clues: neighbours never contain the answer', () => {
  for (const i of d.answers) {
    const a = d.items[i];
    for (const n of a.nn) { assert.ok(!n.includes(a.w) && !a.w.includes(n), `${a.w} ~ ${n}`); assert.match(n, /^[a-z]{3,}$/); }
    assert.equal(new Set(a.nn).size, 4);
  }
});
test('scoring extremes (guess preset default: 100*(6-n+1)/6)', () => {
  const sc = (n) => Math.round(100 * (6 - n + 1) / 6);
  assert.equal(sc(1), 100); assert.equal(sc(6), 17); assert.ok(sc(3) > sc(4));
});
test('guessing information is not trivial: curve alone rarely identifies the word', () => {
  // the answer must be distinguishable but not by peak year alone: >=3 answerable words per +-5y peak window on average
  const peaks = d.answers.map((i) => d.items[i].peak);
  const avg = peaks.reduce((s, p) => s + peaks.filter((q) => Math.abs(q - p) <= 5).length, 0) / peaks.length;
  assert.ok(avg >= 3, 'avg peers ' + avg);
});
