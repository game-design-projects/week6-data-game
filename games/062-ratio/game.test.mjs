import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { cmp, ratioText, explain, lookalikes } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const a = { pct: { flour: 50, liquid: 20, fat: 20, egg: 10 } };
test('cmp hit/arrow', () => {
  const r = cmp({ pct: { flour: 49, liquid: 40, fat: 5, egg: 10 } }, a);
  assert.equal(r[0].state, 'hit'); assert.match(r[1].text, /↓/); assert.match(r[2].text, /↑/);
});
test('ratioText', () => assert.equal(ratioText(a.pct), '50 : 20 : 20 : 10'));

test('pool: every dish is well-formed', () => {
  assert.ok(data.dishes.length >= 60);
  const ids = new Set(), ratios = new Set();
  for (const d of data.dishes) {
    assert.ok(d.id && !ids.has(d.id)); ids.add(d.id);
    assert.ok(d.name && d.name.length > 2);
    const sum = Object.values(d.pct).reduce((x, y) => x + y, 0);
    assert.equal(sum, 100, d.name);
    for (const v of Object.values(d.pct)) assert.ok(Number.isInteger(v) && v >= 0 && v <= 100);
    assert.ok(d.pct.flour >= 5 && d.pct.fat <= 60, d.name);
    assert.ok(d.sugarPct >= 0 && d.sugarPct < 200);
    assert.ok(d.cat, d.name);
    assert.match(d.img, /^https:\/\/www\.themealdb\.com\/images\/media\/meals\/[\w-]+\.jpg$/, d.name);
    if (d.src) assert.match(d.src, /^https?:\/\//);
    const rk = Object.values(d.pct).join(':'); assert.ok(!ratios.has(rk), 'dup ratio ' + d.name); ratios.add(rk);
    // no name word leaks through the "other ingredients" clue
    for (const e of d.extra) for (const w of d.name.toLowerCase().split(/[^a-zà-ÿ]+/).filter((x) => x.length >= 4)) assert.ok(!e.toLowerCase().includes(w.replace(/s$/, '')), `${d.name} leaks via ${e}`);
  }
});

test('puzzle() days 1-120 valid and answer is selectable', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const items = (arr) => arr[(day * 7) % arr.length];
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: 'ratio', rng: null, pick: items });
    assert.ok(data.dishes.some((d) => d.id === p.id));
    seen.add(p.id);
  }
  assert.ok(seen.size >= 30);
});

test('explain: specific text and look-alikes', () => {
  for (const d of data.dishes) {
    const ex = explain(d, data.dishes);
    assert.ok(ex.bits.length >= 1 && ex.bits.every((b) => b && !/undefined|NaN/.test(b)), d.name);
    assert.equal(ex.near.length, 2);
    assert.ok(!ex.near.some((n) => n.startsWith(d.name + ' (')));
  }
  assert.equal(lookalikes(data.dishes[0], data.dishes, 3).length, 3);
});

test('feedback extremes: self is all hit; a far dish has arrows', () => {
  const d0 = data.dishes[0];
  assert.ok(cmp(d0, d0).every((c) => c.state === 'hit'));
  const far = [...data.dishes].sort((x, y) => Math.abs(y.pct.liquid - d0.pct.liquid) - Math.abs(x.pct.liquid - d0.pct.liquid))[0];
  assert.ok(cmp(far, d0).some((c) => /[↑↓]/.test(c.text)));
});

test('scoring text matches engine default 100*(7-n)/6', () => {
  const s = (n) => Math.round(100 * (6 - n + 1) / 6);
  assert.deepEqual([1, 2, 6].map(s), [100, 83, 17]);
  assert.match(game.meta.scoring, /83 on the 2nd guess/);
});
