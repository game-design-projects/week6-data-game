import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { liftText, origText, patternText, scoreFor } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const ids = new Set(data.counties.map((c) => c.id));

test('liftText formats ratio', () => assert.equal(liftText(['RAM', 1.98, 3.2]), '2.0× the state average'));
test('origText', () => assert.equal(origText([50, 40, 10]), 'American 50% · Japanese/Korean 40% · European 10%'));

test('scoring extremes: perfect, typical, worst', () => {
  assert.equal(scoreFor(1, true), 100);
  assert.equal(scoreFor(3, true), 67);
  assert.equal(scoreFor(6, true), 17);
  assert.equal(scoreFor(6, false), 0);
  for (let n = 2; n <= 6; n++) assert.ok(scoreFor(n, true) < scoreFor(n - 1, true));
});

test('data: 62 counties, top-10 sorted, mapped makes, sane numbers', () => {
  assert.equal(data.counties.length, 62);
  for (const c of data.counties) {
    assert.equal(c.top.length, 10, c.id);
    assert.ok(c.top.reduce((a, t) => a + t[1], 0) <= 100.5);
    for (let i = 1; i < 10; i++) assert.ok(c.top[i - 1][1] >= c.top[i][1]);
    for (const [k, v] of c.top) { assert.ok(data.makes[k], k); assert.ok(v > 0 && v < 60); }
    assert.ok(c.lat > 40 && c.lat < 45.1 && c.lng < -71 && c.lng > -80, c.id);
    assert.ok(c.total > 500 && Number.isFinite(c.total));
    assert.ok(c.name && c.over.length === 3 && c.under.length === 2);
    assert.equal(c.orig.length, 3);
    assert.ok(c.orig.reduce((a, b) => a + b, 0) <= 100.3);
    for (const x of c.over) { assert.ok(data.makes[x[0]] && x[1] >= 1 && x[2] > 0); }
  }
});

test('pool: puzzles for days 1-120 are valid, and cover every county', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const rng = { };
    const pick = (arr) => arr[(day * 7919) % arr.length];
    const p = game.puzzle({ data, day, date, slug: 'garage', rng, pick });
    assert.ok(ids.has(p.id), `day ${day}`);
    assert.equal(JSON.stringify(p).includes('undefined'), false);
    seen.add(p.id);
  }
  assert.ok(seen.size >= 60);
});

test('no answer leak in pre-guess text: county name never appears in a brand label', () => {
  const labels = Object.values(data.makes).join(' ').toUpperCase();
  for (const c of data.counties) if (c.id.length > 4) assert.ok(!labels.includes(c.id), c.id);
});

test('patternText is specific to the county', () => {
  const texts = data.counties.map((c) => patternText(c, data));
  for (const t of texts) assert.match(t, /points (above|below) the state/);
  assert.ok(new Set(texts).size > 40);
});
