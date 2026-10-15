import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { dir, shapeOf, patterns, shapeDist } from './game.js';
import { makeRng, dailyIndex } from '../../engine/core.js';

const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const ages = d.ages.map((a) => (a === '80UP' ? '80+' : `${+a.slice(0, 2)}–${+a.slice(2)}`));

test('dir', () => { assert.equal(dir(30, 40), '↑'); assert.equal(dir(40, 30), '↓'); assert.equal(dir(30, 31, 1.5), '✓'); });
test('shapeOf', () => { assert.match(shapeOf({ med: 17 }), /true pyramid/); assert.match(shapeOf({ med: 45 }), /aging/); });

test('data sanity', () => {
  assert.ok(d.countries.length >= 60);
  const ids = new Set(), names = new Set();
  for (const c of d.countries) {
    assert.ok(!ids.has(c.id), 'dup id ' + c.id); ids.add(c.id);
    assert.ok(!names.has(c.name), 'dup name ' + c.name); names.add(c.name);
    for (const k of ['id', 'cc', 'name', 'region', 'income']) assert.ok(c[k] && typeof c[k] === 'string', `${c.id}.${k}`);
    assert.doesNotMatch(c.name + c.region + c.income, /[^\p{Script=Latin}\x20-\x7e’]/u, c.id);
    for (const k of ['lat', 'lng', 'pop', 'med', 'u15', 'o65', 'fshare']) assert.ok(Number.isFinite(c[k]), `${c.id}.${k}`);
    assert.ok(Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180);
    assert.ok(c.pop >= 1e6 && c.med > 10 && c.med < 55 && c.u15 > 5 && c.o65 > 0 && c.fshare > 25 && c.fshare < 60);
    assert.equal(c.f.length, 17); assert.equal(c.m.length, 17);
    assert.ok([...c.f, ...c.m].every((v) => Number.isFinite(v) && v >= 0 && v < 15));
    const s = [...c.f, ...c.m].reduce((a, b) => a + b, 0); assert.ok(Math.abs(s - 100) < 1.5, c.id);
  }
});

test('puzzles for days 1-120 are valid, and nothing in the page text names the answer', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const p = game.puzzle({ data: d, day, date, slug: 'pyramid', rng: makeRng(day), pick: (a) => a[dailyIndex('pyramid', day, a.length)] });
    assert.ok(p && p.id, `day ${day}`);
    const c = d.countries.find((x) => x.id === p.id);
    assert.ok(c, `answer in options day ${day}`);
    seen.add(p.id);
    // clue text (all but the chart) may not contain the country name 
    const texts = [shapeOf(c), ...patterns(c, ages)].join(' ');
    assert.ok(!texts.toLowerCase().includes(c.name.toLowerCase()), `leak ${c.id}`);
    assert.ok(patterns(c, ages).length >= 2);
  }
  assert.ok(seen.size >= 60, 'variety ' + seen.size);
});

test('shapeDist is a metric-like distance', () => {
  const [a, b] = d.countries;
  assert.equal(shapeDist(a, a), 0); assert.ok(shapeDist(a, b) > 0);
});

test('default scoring extremes: 100 first try, 0 when lost, monotone', () => {
  const sc = (n, won) => (won ? Math.round((100 * (6 - n + 1)) / 6) : 0);
  assert.equal(sc(1, true), 100); assert.equal(sc(6, true), 17); assert.equal(sc(6, false), 0);
  for (let n = 1; n < 6; n++) assert.ok(sc(n, true) > sc(n + 1, true));
});
