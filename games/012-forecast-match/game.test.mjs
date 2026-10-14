import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
test('every puzzle has 5 distinct cities with 24 temps', () => {
  assert.ok(d.puzzles.length >= 60);
  for (const p of d.puzzles) {
    assert.strictEqual(new Set(p.cities.map((c) => c.country)).size, 5);
    for (const c of p.cities) assert.strictEqual(c.t.length, 24);
  }
});
