import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { pickSet, factorOff, lesson } from './game.js';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('factorOff is symmetric and >= 1', () => {
  assert.equal(factorOff(200, 100), factorOff(50, 100));
  assert.equal(factorOff(100, 100), 1);
});
test('pickSet draws 3 distinct magnitude buckets', () => {
  const ids = pickSet(data.awards, makeRng(7), 3);
  assert.equal(new Set(ids.map((i) => data.awards[i].b)).size, 3);
});
test('puzzle deterministic', () => {
  const a = game.puzzle({ data, rng: makeRng(3) }); const b = game.puzzle({ data, rng: makeRng(3) });
  assert.deepEqual(a, b);
});

test('pool valid for days 1-120', () => {
  const ids = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, rng: makeRng(day * 7919) });
    assert.equal(p.ids.length, 3);
    assert.equal(new Set(p.ids).size, 3);
    assert.equal(new Set(p.ids.map((i) => data.awards[i].b)).size, 3);
    for (const i of p.ids) {
      const a = data.awards[i];
      ids.add(a.id);
      for (const k of ['id', 'rec', 'desc', 'ag']) assert.ok(typeof a[k] === 'string' && a[k].length > 2, k);
      assert.ok(Number.isFinite(a.amt) && a.amt >= 5000 && a.amt <= 5e9, `amt ${a.amt}`);
      assert.ok(a.b >= 0 && a.b <= 7);
      assert.ok(!/undefined|NaN/.test(JSON.stringify(a)));
      for (const k of ["naics", "psc", "st"]) assert.ok(a[k] === null || typeof a[k] === "string");
    }
  }
  assert.ok(ids.size >= 60);
});
test('pool has unique ids and no amount leaks in descriptions', () => {
  assert.equal(new Set(data.awards.map((a) => a.id)).size, data.awards.length);
  for (const a of data.awards) {
    assert.ok(!/\$|…/.test(a.desc), a.desc);
    assert.ok(!a.desc.replace(/[, ]/g, '').includes(String(a.amt)), a.desc);
  }
});
test('lesson is specific and mentions direction', () => {
  const a = { desc: 'TASK ORDER FOR SOFTWARE MAINTENANCE', amt: 5e5, b: 3, ag: 'X' };
  assert.match(lesson(a, 1e7), /too high/);
  assert.match(lesson(a, 1e4), /task order/);
  assert.match(lesson({ ...a, desc: 'ZZZ' }, 5e5), /Spot on/);
});
