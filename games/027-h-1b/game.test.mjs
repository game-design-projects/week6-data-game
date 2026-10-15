import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { where, explain } from './game.js';
import { makeRng, dailyIndex, expScore, pctError } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const mk = (day) => {
  const slug = game.meta.slug;
  const pick = (arr) => arr[dailyIndex(slug, day, arr.length)];
  return game.puzzle({ data, day, date: '2026-10-01', slug, rng: makeRng(`${slug}:${day}`), pick });
};
const score = (g, a) => expScore(pctError(g, a), 0.3);

test('where buckets', () => {
  const c = { p25: 100, p75: 200 };
  assert.match(where(50, c), /below/); assert.match(where(150, c), /middle/); assert.match(where(300, c), /above/);
});

test('pool: >= 60 puzzles, unique ids, sane fields', () => {
  assert.ok(data.puzzles.length >= 60);
  assert.equal(new Set(data.puzzles.map((x) => x.id)).size, data.puzzles.length);
  for (const x of data.puzzles) {
    assert.ok(Number.isFinite(x.sal) && x.sal >= 40000 && x.sal <= 400000, x.id);
    assert.match(x.id, /^I-20\d-\d{5}-\d+$/);
    assert.match(x.date, /^2024-\d\d-\d\d$/);
    assert.ok(x.emp && x.title && x.city, x.id);
    assert.ok(data.cells[x.q][x.city], x.id);
    assert.ok(Number.isInteger(x.empN) && x.empN >= 0);
    assert.ok(x.empMed === null || (x.empN >= 2 && x.empMed > 0));
  }
  for (const q of Object.values(data.cells)) for (const c of Object.values(q)) {
    assert.ok(c.n >= 8 && c.p25 <= c.med && c.med <= c.p75 && c.p25 > 0);
  }
});

test('puzzle() days 1-120 valid; refs distinct, exclude own city, no answer leak', () => {
  for (let day = 1; day <= 120; day++) {
    const p = mk(day);
    assert.deepEqual(p, mk(day));
    assert.ok(p.refs.length >= 2, `day ${day}`);
    const cities = p.refs.map((r) => r.city);
    assert.equal(new Set(cities).size, cities.length);
    assert.ok(!cities.includes(p.x.city));
    for (const r of p.refs) { assert.ok(r.med > 0 && Number.isFinite(r.n)); assert.notEqual(r.med, p.x.sal === r.med ? -1 : 0); }
    const txt = explain(p.x, data.cells[p.x.q][p.x.city], p.refs);
    assert.ok(txt.length > 20 && !/undefined|NaN/.test(txt), `day ${day}: ${txt}`);
  }
});

test('explain is puzzle-specific', () => {
  const cell = { med: 150000, p25: 120000, p75: 180000 };
  const refs = [{ city: 'A', med: 100000 }, { city: 'B', med: 110000 }];
  const hi = explain({ sal: 200000, emp: 'ACME INC', empN: 5, empMed: 190000 }, cell, refs);
  assert.match(hi, /city premium/); assert.match(hi, /33% above/); assert.match(hi, /Acme Inc/);
  const lo = explain({ sal: 100000, emp: 'X', empN: 0, empMed: null }, cell, refs);
  assert.match(lo, /33% below/); assert.match(lo, /not enough/);
});

test('scoring extremes and skill gap over the pool', () => {
  assert.equal(score(100000, 100000), 100);
  assert.ok(score(50000, 100000) < 20);           // half off
  assert.ok(score(400000, 100000) === 0);         // wildly off
  const all = data.puzzles;
  const mean = (f) => all.reduce((s, x) => s + f(x), 0) / all.length;
  const flat = [...all.map((x) => x.sal)].sort((a, b) => a - b)[all.length >> 1];
  const naive = mean((x) => score(flat, x.sal));
  const skilled = mean((x) => score(data.cells[x.q][x.city].med, x.sal));
  console.log('naive flat', naive.toFixed(1), 'cell median', skilled.toFixed(1));
  assert.ok(skilled > naive + 3, 'knowing job + city must clearly beat a flat guess');
  assert.ok(skilled < 85, 'not trivial');
});
