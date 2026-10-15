import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { pctOf, impliedPct, avgFor } from './game.js';
import { makeRng } from '../../engine/core.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
test('pctOf', () => { assert.equal(pctOf(500, 1000), 50); assert.equal(pctOf(1, 0), 0); });
test('impliedPct', () => { assert.equal(Math.round(impliedPct(100, 9800)), 100); });
test('avgFor falls back', () => { assert.equal(avgFor({}, { par: 'x' }), 98); assert.equal(avgFor(data, { par: 'Games' }), data.parAvg.Games); });
test('pool validity', () => {
  const ids = new Set(), LEAK = /(funded|stretch goal|backers?|raised|kickstarter|\$\s?\d)/i;
  assert.ok(data.items.length >= 100);
  for (const x of data.items) {
    for (const k of ['n', 'b', 'cat', 'par', 'cc']) assert.ok(typeof x[k] === 'string' && x[k].length, `${k} ${x.n}`);
    for (const k of ['goal', 'pct', 'pledged', 'backers', 'days', 'year']) assert.ok(Number.isFinite(x[k]) && x[k] > 0, `${k} ${x.n}`);
    assert.ok(x.pct >= 1 && x.pct <= 20000 && x.goal >= 100 && x.days >= 1 && x.days <= 92 && x.year >= 2015);
    assert.ok(Math.abs(pctOf(x.pledged, x.goal) - x.pct) / x.pct < 0.1, x.n);
    assert.ok(!x.url || /^https:\/\/www\.kickstarter\.com\/projects\//.test(x.url), x.n);
    assert.ok(!LEAK.test(x.n + ' ' + x.b), `leak ${x.n}`);
    assert.ok(!ids.has(x.n.toLowerCase()), 'dup ' + x.n); ids.add(x.n.toLowerCase());
  }
});
test('puzzle days 1-120 valid and deterministic', () => {
  for (let day = 1; day <= 120; day++) {
    const mk = () => game.puzzle({ data, day, date: '2026-10-01', slug: 'funded', rng: makeRng?.(day), pick: (a) => a[(day * 7919) % a.length] });
    const p = mk(); assert.deepEqual(p, mk());
    assert.ok(Number.isInteger(p.i) && data.items[p.i]);
  }
});
test('log scoring extremes', () => {
  const sc = (g, a) => 100 * Math.exp(-Math.abs(Math.log10(g / a)) / 0.35);
  assert.equal(sc(100, 100), 100); assert.ok(Math.round(sc(200, 100)) === 42); assert.ok(sc(1, 20000) < 1);
});
