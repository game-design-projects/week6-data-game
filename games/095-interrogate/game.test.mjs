import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { buildQuestions, parseQuestion, bestPath, scoreFor, enName, IND, MAX_Q } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const all = data.countries;

test('score extremes', () => {
  assert.equal(scoreFor(0, 1, true), 100);
  assert.equal(scoreFor(5, 1, true), 85);
  assert.equal(scoreFor(5, 2, true), 73);
  assert.equal(scoreFor(MAX_Q, 3, true), 16);
  assert.equal(scoreFor(MAX_Q, 3, false), 0);
  assert.equal(scoreFor(30, 3, true), 10); // floor
});

test('questions split the pool, are deterministic and do not depend on the answer', () => {
  const qs = buildQuestions(all);
  assert.ok(qs.length >= 50);
  assert.equal(new Set(qs.map((q) => q.id)).size, qs.length);
  for (const q of qs) {
    const yes = all.filter(q.test).length;
    assert.ok(yes > 0 && yes < all.length, q.id);
    assert.ok(q.text && q.short && q.group, q.id);
  }
  assert.deepEqual(qs.map((q) => q.text), buildQuestions(all).map((q) => q.text));
});

test('menu questions tell every country apart', () => {
  const qs = buildQuestions(all);
  const sig = new Set(all.map((c) => qs.map((q) => +q.test(c)).join('')));
  assert.equal(sig.size, all.length);
});

test('a good player can win: greedy path is short for every country', () => {
  const qs = buildQuestions(all);
  let total = 0;
  for (const c of all) {
    const b = bestPath(all, c, qs);
    assert.equal(b.left, 1, c.name);
    assert.ok(b.steps.length <= 10, `${c.name} ${b.steps.length}`);
    total += b.steps.length;
  }
  const avg = total / all.length;
  assert.ok(avg < 8.5, `avg ${avg}`);
  assert.ok(scoreFor(Math.ceil(avg), 1, true) >= 70); // good play scores well, blind play does not
});

test('free text routes to queries or asks to rephrase', () => {
  const ok = (t) => { const r = parseQuestion(t, all); assert.ok(r.ok, `${t} → ${r.msg}`); return r.q; };
  const bad = (t) => { const r = parseQuestion(t, all); assert.equal(r.ok, false, t); assert.ok(r.msg); return r; };
  const q1 = ok('Is the population over 50 million?');
  assert.equal(q1.test({ v: { pop: 6e7 } }), true);
  assert.equal(q1.test({ v: { pop: 4e7 } }), false);
  assert.equal(ok('population below 1 billion').test({ v: { pop: 6e7 } }), true);
  assert.equal(ok('life expectancy above 75 years').test({ v: { life: 74.9 } }), false);
  assert.equal(ok('Is the capital in the southern hemisphere?').test({ lat: -10 }), true);
  assert.equal(ok('in Europe?').test({ region: 'Europe & Central Asia' }), true);
  assert.equal(ok('lower middle income country?').test({ income: 'Lower middle income' }), true);
  assert.equal(ok('Health spending over 10% of GDP').test({ v: { health: 11 } }), true);
  assert.equal(ok('GDP per capita over $10,000').test({ v: { gdp: 12000 } }), true);
  assert.equal(ok('GDP per capita not above 10k').test({ v: { gdp: 12000 } }), false);
  assert.equal(ok('land area at least 1 million km2').test({ v: { area: 2e6 } }), true);
  ok('Is GDP per capita high?');
  bad('hello');
  bad('what is the population');
  bad('population over 5');
  bad('Africa?');
  bad('population and GDP');
  bad('GDP per capita over 1');
});

test('pool validity over days 1–120', () => {
  const names = new Set();
  const ccs = new Set();
  for (const c of all) {
    assert.match(c.cc, /^[A-Z]{2}$/);
    assert.ok(!ccs.has(c.cc), 'dup ' + c.cc); ccs.add(c.cc);
    const n = enName(c.cc, c.name);
    assert.match(n, /^[A-Za-z\u00c0-\u024f]/, `English name ${c.cc} ${n}`);
    assert.ok(!names.has(n), 'dup label ' + n); names.add(n);
    assert.ok(c.capital && c.region && c.income);
    assert.ok(Number.isFinite(c.lat) && Math.abs(c.lat) <= 90 && Number.isFinite(c.lng) && Math.abs(c.lng) <= 180);
    for (const k of Object.keys(IND)) assert.ok(Number.isFinite(c.v[k]) && c.v[k] >= 0, `${c.cc}.${k}`);
    assert.ok(c.v.life > 40 && c.v.life < 95 && c.v.fert > 0.5 && c.v.fert < 9 && c.v.pop >= 1.5e6);
    for (const k of ['urban', 'net', 'forest', 'health']) assert.ok(c.v[k] <= 100, `${c.cc}.${k}`);
  }
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const pick = (arr) => arr[(day * 7919) % arr.length];
    const p = game.puzzle({ data, day, pick });
    assert.ok(ccs.has(p.cc), `day ${day}`);
    assert.deepEqual(Object.keys(p), ['cc']);
    seen.add(p.cc);
  }
  assert.ok(seen.size >= 60);
});
