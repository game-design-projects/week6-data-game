import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import g, { summarize } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('summarize shares sum to 1 and find solar peak', () => {
  const m = { gas: [10, 10, 10], solar: [0, 5, 1], coal: [0, 0, 0] };
  const s = summarize(m, 10);
  assert.equal(s.all, 360);
  assert.ok(Math.abs(Object.values(s.share).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(s.solarPeak, 1);
  assert.equal(s.dominant, 'gas');
});

test('every puzzle refers to a known BA with 24 hours', () => {
  const ids = new Set(data.bas.map((b) => b.id));
  for (const p of data.puzzles) {
    assert.ok(ids.has(p.ba));
    for (const k of data.fuels) assert.equal(p.m[k].length, 24);
  }
});

test('puzzle is deterministic', () => {
  const pick = (a) => a[3];
  assert.deepEqual(g.puzzle({ data, pick }), g.puzzle({ data, pick }));
});

import { explain, TZ_ZH, FUEL_ZH } from './game.js';

test('pool: 120 days of puzzles are all valid', async () => {
  const core = await import('../../engine/core.js');
  const ids = new Set(data.bas.map((b) => b.id));
  assert.ok(data.puzzles.length >= 60);
  assert.ok(JSON.stringify(data).length < 1.5e6);
  const keys = new Set();
  for (const p of data.puzzles) {
    const k = `${p.ba}|${p.date}`;
    assert.ok(!keys.has(k), `dup ${k}`);
    keys.add(k);
    assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/);
  }
  for (const b of data.bas) {
    assert.ok(b.id && b.name && b.area, b.id);
    assert.ok(Number.isFinite(b.mean) && b.mean >= 1000 && b.mean < 200000, b.id);
    assert.ok(TZ_ZH[b.off], `${b.id} off ${b.off}`);
    assert.ok(Object.keys(b.typ).length >= 1);
  }
  assert.equal(new Set(data.bas.map((b) => b.id)).size, data.bas.length);
  const nameSet = new Set(data.bas.map((b) => b.name));
  assert.equal(nameSet.size, data.bas.length);
  for (const f of data.fuels) assert.ok(FUEL_ZH[f]);
  for (let day = 1; day <= 120; day++) {
    const pick = core.makePick ? core.makePick(data.puzzles.length, day, 'grid-mix') : (a) => a[day % a.length];
    const pz = g.puzzle({ data, day, pick });
    assert.ok(ids.has(pz.ba), `day ${day}`);
    const p = data.puzzles.find((x) => x.ba === pz.ba && x.date === pz.date);
    assert.ok(p, `day ${day} puzzle missing`);
    let total = 0;
    for (const f of data.fuels) {
      assert.equal(p.m[f].length, 24);
      for (const v of p.m[f]) { assert.ok(Number.isFinite(v) && v >= 0 && v < 20000, `${pz.ba} ${pz.date} ${f}=${v}`); total += v; }
    }
    assert.ok(total > 0);
    const { notes, S } = explain(p.m, data.bas.find((b) => b.id === pz.ba), data.unit);
    assert.ok(notes.length >= 2 && notes.every((n) => !/undefined|NaN/.test(n)), `${pz.ba} ${pz.date}: ${notes}`);
    assert.ok(S.mean > 0 && Number.isFinite(S.solarPeak));
  }
});

test('answer leaks: no BA name, id or area inside any clue-visible static text', () => {
  const meta = g.meta;
  const vis = [meta.tagline, meta.title, ...meta.howTo].join(' ');
  for (const b of data.bas) assert.ok(!vis.includes(b.name) && !vis.includes(`(${b.id})`), b.id);
});

test('scoring extremes via default guess scoring', () => {
  const sc = (n, won) => (won ? Math.round((100 * (6 - n + 1)) / 6) : 0);
  assert.equal(sc(1, true), 100);
  assert.equal(sc(6, true), 17);
  assert.equal(sc(6, false), 0);
  assert.ok(sc(2, true) > sc(3, true));
});

test('explain: duck curve and nuclear base are named', () => {
  const m = { coal: Array(24).fill(0), gas: Array(24).fill(100), nuclear: Array(24).fill(50), oil: Array(24).fill(0), hydro: Array(24).fill(0), wind: Array(24).fill(0), other: Array(24).fill(0), solar: Array.from({ length: 24 }, (_, i) => (i >= 8 && i <= 16 ? 80 : 0)) };
  const { notes } = explain(m, { name: 'X', typ: { gas: 60 } }, 10);
  assert.ok(notes.some((n) => n.includes('太阳能')));
  assert.ok(notes.some((n) => n.includes('平直')));
  assert.ok(notes.some((n) => n.includes('常年平均')));
});
