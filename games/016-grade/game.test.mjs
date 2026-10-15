import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { gradeOf, scoreGuess, ptsOf, typicalTotal, explain } from './game.js';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('gradeOf', () => { assert.equal(gradeOf(13), 'A'); assert.equal(gradeOf(14), 'B'); assert.equal(gradeOf(27), 'B'); assert.equal(gradeOf(28), 'C'); });

test('scoring extremes', () => {
  assert.equal(scoreGuess(10, 10), 100);
  assert.ok(scoreGuess(20, 10) < scoreGuess(12, 10));
  assert.ok(scoreGuess(11, 10) >= 85);            // close = rewarded
  assert.ok(scoreGuess(0, 60) <= 1);              // worst case ~ 0
  // always guessing 13 (the old trivial strategy) must not score high across the pool
  const avg = data.items.reduce((s, i) => s + scoreGuess(13, i.score), 0) / data.items.length;
  assert.ok(avg < 55, `constant guess averages ${avg}`);
});

test('pool: every item is valid', () => {
  assert.ok(data.items.length >= 60);
  const names = new Set();
  for (const i of data.items) {
    assert.ok(i.name && i.cuisine && /^[A-Za-z ]+$/.test(i.boro), i.name);
    assert.match(i.date, /^20\d\d-\d\d-\d\d$/);
    assert.ok(Number.isInteger(i.score) && i.score >= 0 && i.score <= 60, i.name);
    assert.equal(i.grade, gradeOf(i.score), i.name);
    assert.equal(i.v.length, 3);
    assert.equal(new Set(i.v.map((v) => v.code)).size, 3, `dup code ${i.name}`);
    for (const v of i.v) {
      assert.ok(v.text.length > 10 && !/undefined|NaN/.test(v.text));
      assert.ok(data.plain[v.code], `no plain gloss for ${v.code}`);
      assert.ok(ptsOf(data.pts, v), `no pts for ${v.code}`);
    }
    assert.ok(!names.has(i.name.toLowerCase()), `dup name ${i.name}`); names.add(i.name.toLowerCase());
  }
  const g = { A: 0, B: 0, C: 0 }; data.items.forEach((i) => g[i.grade]++);
  assert.ok(g.A >= 20 && g.B >= 20 && g.C >= 20, JSON.stringify(g));
});

test('puzzle() days 1–120 valid and answer not leaked in visible fields', () => {
  for (let day = 1; day <= 120; day++) {
    const rng = makeRng ? makeRng(`g${day}`) : null;
    const pick = (arr) => arr[(day * 7919) % arr.length];
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: 'grade', rng, pick });
    const { item } = p;
    assert.ok(item && item.v.length === 3);
    for (const v of item.v) { // visible text must not contain the restaurant name or the score
      assert.ok(!v.text.toLowerCase().includes(item.name.toLowerCase()));
      assert.ok(!(data.plain[v.code]).includes(String(item.score) + ' pts'));
    }
    assert.ok(!/undefined|NaN/.test(JSON.stringify(item)));
  }
});

test('explain is specific and typicalTotal sane', () => {
  for (const i of data.items) {
    const t = typicalTotal(i, data.pts);
    assert.ok(t >= 0 && t <= 90, i.name);
    assert.ok(explain(i, data.pts).includes(String(i.score)));
  }
});
