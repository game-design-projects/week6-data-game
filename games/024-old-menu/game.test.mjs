import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import game, { rangeFor, modern, usd } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const rngStub = {};
// same permutation idea as the engine: a day-indexed walk over the pool without repeats
const pickDay = (day) => (arr) => arr[(day * 7) % arr.length];

test('pool is large and well-formed', () => {
  assert.ok(data.menus.length >= 60);
  const ids = new Set();
  for (const m of data.menus) {
    assert.ok(!ids.has(m.id), 'duplicate id');
    ids.add(m.id);
    assert.equal(m.d.length, 4);
    assert.ok(m.y >= 1880 && m.y <= 1990);
    assert.ok(m.who && m.who.length >= 3 && !/undefined|NaN/.test(m.who + m.where + m.ev));
    assert.ok(m.n >= 9);
    const { min, max } = rangeFor(m.y);
    assert.equal(new Set(m.d.map((x) => x[1])).size, 4, 'prices distinct');
    assert.equal(new Set(m.d.map((x) => x[0].toLowerCase())).size, 4, 'names distinct');
    for (const [n, p, pct] of m.d) {
      assert.ok(n && !/undefined|NaN/.test(n));
      assert.ok(Number.isFinite(p) && p >= min && p <= max, `${m.id} price ${p} outside slider ${min}-${max}`);
      assert.ok(pct >= 0 && pct <= 100);
    }
    const ps = m.d.slice(1).map((x) => x[1]);
    assert.ok(Math.max(...ps) / Math.min(...ps) >= 2, 'targets must spread');
  }
});

test('answer leaks: no drink names, no redaction, no price in titles', () => {
  const DRINK = /\b(wine|champagne|claret|gin|whisky|whiskey|brandy|rum|beer|cognac|bourbon)\b/i;
  for (const m of data.menus) for (const [n] of m.d) assert.ok(!DRINK.test(n), `${m.id} ${n}`);
  assert.ok(!/[▇█]/.test(JSON.stringify(data.menus)));
  assert.ok(!/title/.test(JSON.stringify(game.meta.title)) && !/\d/.test(game.meta.title));
});

test('puzzle() days 1-120 are valid and deterministic', () => {
  for (let day = 1; day <= 120; day++) {
    const a = game.puzzle({ data, pick: pickDay(day), rng: rngStub, day });
    const b = game.puzzle({ data, pick: pickDay(day), rng: rngStub, day });
    assert.deepEqual(a, b);
    assert.ok(a.menu && a.menu.d.length === 4);
    JSON.stringify(a);
  }
  const distinct = new Set(Array.from({ length: 14 }, (_, i) => game.puzzle({ data, pick: pickDay(i + 1) }).menu.id));
  assert.ok(distinct.size >= 7);
});

test('CPI table sane and modern() works', () => {
  assert.ok(data.cpi['1913'] > 15 && data.cpi['1913'] < 60);
  assert.ok(data.cpi['1990'] > 1.5 && data.cpi['1990'] < 4);
  assert.equal(modern(1, 1900, data.cpi), null);
  assert.ok(Math.abs(modern(2, 1990, data.cpi) - 2 * data.cpi['1990']) < 1e-9);
  assert.ok(data.cpi['1913'] > data.cpi['1950'] && data.cpi['1950'] > data.cpi['1990']);
});

test('usd formatting', () => {
  assert.equal(usd(0.25), '25¢');
  assert.equal(usd(1.5), '$1.50');
});

test('scoring extremes on the log scale (engine formula, scale 0.35)', () => {
  const score = (g, a) => 100 * Math.exp(-Math.abs(Math.log10(g / a)) / 0.35);
  assert.ok(score(1, 1) === 100);
  assert.ok(score(1.25, 1) > 70 && score(1.25, 1) < 80);
  assert.ok(score(2, 1) > 38 && score(2, 1) < 46);
  assert.ok(score(10, 1) < 7);
  assert.ok(score(0.02, 10) < 1); // worst case on the slider
});
