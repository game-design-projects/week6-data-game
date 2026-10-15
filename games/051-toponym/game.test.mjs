import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { pickThree } from './game.js';
import { makeRng, dailyIndex } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('data well-formed and ids unique', () => {
  assert.ok(data.places.length >= 60);
  assert.equal(new Set(data.places.map((p) => p.id)).size, data.places.length);
  for (const p of data.places) {
    assert.ok(p.meaning && p.lang && p.orig && p.wiki);
    assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
  }
});

test('three distinct places per day, deterministic', () => {
  const run = (day) => pickThree(data.places, (a) => a[dailyIndex('toponym', day, a.length)], makeRng(`toponym:${day}`));
  for (let d = 1; d < 30; d++) {
    const a = run(d);
    assert.equal(new Set(a).size, 3);
    assert.deepEqual(a, run(d));
  }
});

test('puzzle returns ids', () => {
  const p = game.puzzle({ data, pick: (a) => a[0], rng: makeRng('x') });
  assert.equal(p.ids.length, 3);
});

test('pool validity over days 1-120', () => {
  const byId = new Map(data.places.map((p) => [p.id, p]));
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, pick: (a) => a[dailyIndex('toponym', day, a.length)], rng: makeRng(`toponym:${day}`) });
    assert.equal(p.ids.length, 3);
    assert.equal(new Set(p.ids).size, 3, `dup ids day ${day}`);
    for (const id of p.ids) {
      const pl = byId.get(id);
      assert.ok(pl, `unknown id ${id}`);
      for (const k of ['name', 'orig', 'lang', 'meaning', 'kind', 'wiki']) assert.ok(typeof pl[k] === 'string' && pl[k].length && !/undefined|NaN/.test(pl[k]), `${id}.${k}`);
      assert.ok(Number.isFinite(pl.lat) && Number.isFinite(pl.lng));
      assert.ok(data.langNotes[pl.lang], `no langNote for ${pl.lang}`);
      assert.ok(new URL(`https://en.wikipedia.org/wiki/${encodeURIComponent(pl.wiki.replace(/ /g, '_'))}`));
    }
  }
});

test('clues do not leak the answer', () => {
  const seen = new Set();
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const p of data.places) {
    const name = norm(p.name);
    const clue = norm(`${p.meaning} ${p.lang} ${p.kind}`);
    assert.ok(!clue.includes(name), `${p.id} clue contains its name`);
    for (const w of name.split(/[^a-z]+/).filter((x) => x.length >= 4 && x !== 'city')) assert.ok(!clue.includes(w), `${p.id} clue contains name word "${w}"`);
    assert.ok(!/[^\x00-\x7f\u2018\u2019]/.test(p.meaning), `${p.id} meaning is not plain English`);
    assert.ok(!seen.has(p.meaning + p.lang), `ambiguous clue ${p.meaning}/${p.lang}`);
    seen.add(p.meaning + p.lang);
  }
});

test('scoring extremes', () => {
  const score = (km) => 100 * Math.exp(-km / 1500 * 1); // engine: 0 km -> 100, scale -> ~37
  assert.equal(Math.round(score(0)), 100);
  assert.ok(Math.abs(score(1500) - 37) < 1);
  assert.ok(score(15000) < 1);
});
