import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs';
import g, { GENERIC, revealCounts, distinctive, sharedCount, brandWords, MAX_GUESSES } from './game.js';
import { makeRng, dailyIndex } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const slug = g.meta.slug;
const mk = (day) => g.puzzle({ data, day, date: String(day), slug, rng: makeRng(`${slug}:${day}`), pick: (a) => a[dailyIndex(slug, day, a.length)] });
const byId = new Map(data.products.map((p) => [p.id, p]));

test('revealCounts: strictly growing, ends at N, every wrong guess reveals something', () => {
  for (let n = 6; n <= 30; n++) {
    const c = revealCounts(n);
    assert.equal(c.length, MAX_GUESSES);
    assert.equal(c[MAX_GUESSES - 1], n);
    assert.ok(c[0] >= 1 && c[0] <= 3);
    for (let i = 1; i < c.length; i++) assert.ok(c[i] > c[i - 1], `n=${n} stage ${i}: ${c}`);
  }
});

test('scoring text matches the default guess formula at the extremes', () => {
  const score = (n, won) => (won ? Math.round((100 * (MAX_GUESSES - n + 1)) / MAX_GUESSES) : 0);
  assert.equal(score(1, true), 100);
  assert.equal(score(6, true), 17);
  assert.equal(score(6, false), 0);
  assert.ok(score(3, true) > score(4, true));
});

test('data pool size and shape', () => {
  assert.ok(data.products.length >= 60, `pool ${data.products.length}`);
  assert.equal(g.meta.num, 35);
  assert.equal(new Set(data.products.map((p) => p.id)).size, data.products.length);
  assert.equal(new Set(data.products.map((p) => p.name)).size, data.products.length, 'option labels must be unique');
  assert.equal(new Set(data.products.map((p) => p.code)).size, data.products.length);
  assert.equal(new Set(data.products.map((p) => p.ing.join('|'))).size, data.products.length, 'identical ingredient lists are unguessable');
});

test('every product is well-formed and teachable', () => {
  for (const p of data.products) {
    for (const k of ['id', 'name', 'brand', 'code', 'cat']) assert.ok(typeof p[k] === 'string' && p[k].trim() && !/undefined|NaN/.test(p[k]), `${p.id}.${k}`);
    assert.match(p.code, /^\d{8,14}$/);
    assert.ok(p.ing.length >= 6 && p.ing.length <= 30, p.name);
    assert.equal(new Set(p.ing).size, p.ing.length, `${p.name} duplicate ingredients`);
    assert.ok(p.ing.filter((i) => !GENERIC.has(i)).length >= 4, `${p.name} too generic`);
    for (const id of p.ing) {
      const d = data.dict[id];
      assert.ok(typeof d === 'string' && d.trim() && !/undefined|NaN/.test(d), `${p.name}: ${id} has no English name`);
      assert.match(d, /^[A-Za-z0-9]/, `${id} English name`);
      assert.doesNotMatch(d, /[^\x00-\u024f\u2018-\u201d]/, `${id} has non-English characters`);
    }
  }
});

test('answer leaks: no ingredient name contains a product or brand word', () => {
  for (const p of data.products) {
    const words = brandWords(p.name, p.brand);
    for (const id of p.ing) {
      const txt = `${id} ${data.dict[id]}`.toLowerCase();
      for (const w of words) assert.ok(!txt.includes(w), `${p.name}: ingredient "${id}" contains "${w}"`);
    }
  }
});

test('days 1-120: every puzzle is valid and the answer is selectable', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = mk(day);
    assert.deepEqual(p, mk(day), 'deterministic');
    const prod = byId.get(p.id);
    assert.ok(prod, `day ${day}: unknown id`);
    assert.equal(data.products.filter((x) => x.name === prod.name).length, 1);
    const c = revealCounts(prod.ing.length);
    assert.ok(c[0] < prod.ing.length);
    seen.add(p.id);
  }
  assert.ok(seen.size >= 60);
  // no repeats inside the first pool cycle
  const first = []; for (let d = 1; d <= data.products.length; d++) first.push(mk(d).id);
  assert.equal(new Set(first).size, data.products.length);
});

test('feedback helpers', () => {
  const a = { ing: ['a', 'b', 'c'] }, b = { ing: ['c', 'd'] };
  assert.equal(sharedCount(a, b), 1);
  assert.equal(sharedCount(a, a), 3);
  const prods = [{ ing: ['a', 'b', 'c'] }, { ing: ['a', 'x'] }, { ing: ['a', 'y'] }];
  const d = distinctive(prods[0], prods, 2);
  assert.equal(d.length, 2);
  assert.ok(d.every((x) => x.df === 1));
});
