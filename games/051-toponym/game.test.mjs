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

test('pool validity over days 1-120', () => {
  const byId = new Map(data.places.map((p) => [p.id, p]));
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, pick: (a) => a[dailyIndex('toponym', day, a.length)], rng: makeRng(`toponym:${day}`) });
    assert.equal(p.ids.length, 3);
    assert.equal(new Set(p.ids).size, 3, `dup ids day ${day}`);
    for (const id of p.ids) {
      const pl = byId.get(id);
      assert.ok(pl, `unknown id ${id}`);
      for (const k of ['name', 'orig', 'lang', 'zh', 'kind', 'wiki']) assert.ok(typeof pl[k] === 'string' && pl[k].length && !/undefined|NaN/.test(pl[k]), `${id}.${k}`);
      assert.ok(Number.isFinite(pl.lat) && Number.isFinite(pl.lng));
      assert.ok(data.langNotes[pl.lang], `no langNote for ${pl.lang}`);
      assert.ok(new URL(`https://en.wikipedia.org/wiki/${encodeURIComponent(pl.wiki.replace(/ /g, '_'))}`));
    }
  }
});

test('clues do not leak the answer', () => {
  const seen = new Set();
  for (const p of data.places) {
    const cn = p.name.split(' ')[0];
    const latin = p.name.slice(cn.length).trim().toLowerCase();
    const clue = `${p.zh}${p.lang}${p.kind}`;
    assert.ok(!clue.includes(cn), `${p.id} clue contains its Chinese name`);
    for (let i = 0; i + 2 <= cn.length; i++) assert.ok(!p.zh.includes(cn.slice(i, i + 2)), `${p.id} zh shares a bigram with name ${cn}`);
    assert.ok(!clue.toLowerCase().includes(latin), `${p.id} latin name in clue`);
    assert.ok(!/[A-Za-z]/.test(p.zh), `${p.id} zh has latin letters`);
    assert.ok(!seen.has(p.zh + p.lang), `ambiguous clue ${p.zh}/${p.lang}`);
    seen.add(p.zh + p.lang);
  }
});

test('scoring extremes', () => {
  const score = (km) => 100 * Math.exp(-km / 1500 * 1); // engine: 0 km -> 100, scale -> ~37
  assert.equal(Math.round(score(0)), 100);
  assert.ok(Math.abs(score(1500) - 37) < 1);
  assert.ok(score(15000) < 1);
});
