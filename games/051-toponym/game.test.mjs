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
    assert.ok(p.zh && p.lang && p.orig && p.wiki);
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
