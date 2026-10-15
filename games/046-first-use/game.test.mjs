import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { yearScore, freeZone, fmtYear, pattern, MIN_YEAR, MAX_YEAR } from './game.js';
import { dailyIndex, makeRng, addDays } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const mk = (day) => {
  const date = addDays('2026-10-01', day - 1);
  return game.puzzle({ data, day, date, slug: 'first-use', rng: makeRng(`first-use:${date}`), pick: (a) => a[dailyIndex('first-use', day, a.length)] });
};

test('yearScore extremes', () => {
  assert.equal(yearScore(1600, 1602), 1);
  assert.equal(yearScore(1600, 1603, 5), 1);
  assert.ok(yearScore(1700, 1600) < yearScore(1650, 1600));
  assert.ok(yearScore(MIN_YEAR, 2004) < 0.01); // worst possible
  const typical = yearScore(1900, 1850); // 50 years off
  assert.ok(typical > 0.3 && typical < 0.6, String(typical));
});

test('pool is large and spread over eras', () => {
  assert.ok(data.words.length >= 100, String(data.words.length));
  const eras = new Set(data.words.map((x) => Math.floor(x.y / 50)));
  assert.ok(eras.size >= 9);
});

test('pool validity over days 1-120', () => {
  const ids = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = mk(day);
    for (const k of ['w', 'gloss', 'o', 'ex']) assert.ok(typeof p[k] === 'string' && p[k].length > 0 && !/undefined|NaN/.test(p[k]), `${day}.${k}`);
    assert.match(p.w, /^[a-z]+$/);
    assert.ok(Number.isInteger(p.y) && p.y >= MIN_YEAR && p.y <= MAX_YEAR, `${p.w} year ${p.y}`);
    assert.ok(p.d === 0 || p.d === 1);
    assert.ok(p.gloss.length >= 8 && p.gloss.length <= 80, `gloss length of ${p.w}`);
    assert.ok(fmtYear(p).includes(String(p.d ? p.y - 5 : p.y)));
    assert.ok(pattern(p).length > 20);
    assert.ok(freeZone(p) >= 2);
    if (day <= data.words.length) { assert.ok(!ids.has(p.w), `dup ${p.w}`); ids.add(p.w); }
  }
  assert.equal(new Set(data.words.map((x) => x.w)).size, data.words.length);
});

test('no answer leak: gloss never contains the year, excerpt is only shown after the guess', () => {
  for (const x of data.words) {
    assert.ok(!/\d{4}/.test(x.gloss), x.w);
    assert.ok(!new RegExp(`\\b${x.w}`, 'i').test(x.gloss), `gloss of ${x.w} contains the word`);
    assert.ok(!/[^\x20-\x7e\u2019]/.test(x.gloss + x.o), `non-ASCII in ${x.w}`);
    assert.ok(!/\d{3,4}/.test(x.o), x.w);
    assert.ok(x.ex.startsWith(String(x.y - (x.d ? 5 : 0))), `${x.w} excerpt must start with its date`);
  }
});
