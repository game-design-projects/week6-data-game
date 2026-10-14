import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { corr, diffs } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
test('corr basics', () => { assert.ok(Math.abs(corr([1, 2, 3], [2, 4, 6]) - 1) < 1e-9); assert.ok(corr([1, 2, 3], [3, 2, 1]) < -0.99); assert.deepEqual(diffs([1, 3, 6]), [2, 3]); });
test('every set has exactly one pair r>0.9 and it matches t', () => {
  for (const s of data.sets) {
    const v = s.s.map((k) => data.lib[k]);
    const hi = [];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) { const r = corr(v[i], v[j]); if (r > 0.9) hi.push([i, j]); else assert.ok(Math.abs(r) < 0.72); }
    assert.deepEqual(hi, [s.t]);
  }
});
