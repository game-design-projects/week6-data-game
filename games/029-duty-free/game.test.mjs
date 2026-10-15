import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { explain, scoreGuess } from './game.js';
import { makeRng, dailyIndex } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));

function puzzleFor(day) {
  const rng = makeRng(`${game.meta.slug}:${day}`);
  const pick = (arr) => arr[dailyIndex(game.meta.slug, day, arr.length)];
  return game.puzzle({ data, day, slug: game.meta.slug, rng, pick });
}

test('pool has ≥ 60 puzzles of 3 distinct items, no item reused', () => {
  assert.ok(data.puzzles.length >= 60);
  const seen = new Set();
  for (const p of data.puzzles) {
    assert.equal(p.length, 3);
    for (const i of p) { assert.ok(!seen.has(i), `item ${i} reused`); seen.add(i); }
    assert.equal(new Set(p.map((i) => data.items[i].c)).size, 3, 'chapters distinct within a puzzle');
  }
});

test('every item is well-formed and leak-free', () => {
  const ids = new Set();
  for (const it of data.items) {
    assert.match(it.h, /^\d{4}\.\d\d\.\d\d$/);
    assert.ok(!ids.has(it.h), 'dup ' + it.h); ids.add(it.h);
    assert.ok(Number.isFinite(it.r) && it.r >= 0 && it.r <= 40, it.h);
    assert.ok(it.d && it.d.length >= 25 && it.d.length <= 300, it.h);
    assert.ok(data.names[it.c] && data.chapters[it.c], it.h);
    assert.ok(!/undefined|NaN|<|&nbsp;/.test(it.d), it.h);
    assert.ok(!/\b(duty|duties|tariff|free of)\b/i.test(it.d), it.h);
    assert.ok(it.o == null || (Number.isFinite(it.o) && it.o >= 0), it.h);
    assert.ok(!/Other › Other$/i.test(it.d), it.h);
  }
});

test('puzzle() valid for days 1-120', () => {
  for (let day = 1; day <= 120; day++) {
    const p = puzzleFor(day);
    assert.equal(p.items.length, 3);
    assert.equal(new Set(p.items).size, 3);
    for (const h of p.items) assert.ok(data.items.some((x) => x.h === h), `day ${day} ${h}`);
    assert.deepEqual(p, puzzleFor(day));
  }
  const first = new Set(); for (let d = 1; d <= 90; d++) first.add(puzzleFor(d).items.join());
  assert.equal(first.size, 90, 'no repeats in the first cycle');
});

test('rate mix is varied: free, low and high all appear', () => {
  const r = data.items.map((x) => x.r);
  assert.ok(r.filter((v) => v === 0).length >= 30);
  assert.ok(r.filter((v) => v > 10).length >= 30);
  assert.ok(r.filter((v) => v > 0 && v <= 5).length >= 30);
});

test('scoring extremes', () => {
  assert.equal(scoreGuess(5, 5), 100);
  assert.ok(scoreGuess(8, 5) > 30 && scoreGuess(8, 5) < 40);
  assert.ok(scoreGuess(40, 0) <= 1);
  for (const g of [0, 5]) {
    const avg = data.items.reduce((s, x) => s + scoreGuess(g, x.r), 0) / data.items.length;
    assert.ok(avg < 55, `constant ${g} avg ${avg}`);
  }
  const med = data.items.reduce((s, x) => s + scoreGuess(data.chapters[x.c].med, x.r), 0) / data.items.length;
  const c5 = data.items.reduce((s, x) => s + scoreGuess(5, x.r), 0) / data.items.length;
  assert.ok(med > c5, `chapter-median ${med} should beat constant 5 (${c5})`);
});

test('explain is specific to the item', () => {
  const a = explain(data.items.find((x) => x.r === 0), data);
  const b = explain(data.items.find((x) => x.r > 15), data);
  assert.match(a, /duty-free/);
  assert.notEqual(a, b);
  assert.ok(!/undefined|NaN/.test(a + b));
});
