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
