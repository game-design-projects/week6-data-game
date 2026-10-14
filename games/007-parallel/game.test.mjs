import test from 'node:test';
import assert from 'node:assert/strict';
import g, { northOf } from './game.js';
import fs from 'node:fs';
test('northOf', () => {
  assert.deepEqual(northOf({ lat: 40.7 }, [{ lat: 41.9 }, { lat: 35 }, { lat: 50 }]), [0, 2]);
});
test('data rounds have 1-4 northerners', () => {
  const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
  for (const p of d.puzzles) for (const r of p.rounds) { const n = northOf(r.ref, r.cands).length; assert.ok(n >= 1 && n <= 4); }
});
