import test from 'node:test'; import assert from 'node:assert';
import fs from 'node:fs';
import { buildRounds } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const rng = { shuffle: (a) => a.slice().reverse(), sample: (a, n) => a.slice(0, n) };
test('rounds contain the right answers', () => {
  for (const r of buildRounds(data, data.traces, rng)) {
    assert.ok(r.lopts.includes(r.t.lang)); assert.ok(r.bopts.includes(r.lib)); assert.equal(new Set(r.bopts).size, r.bopts.length);
  }
});
test('pool', () => { assert.ok(data.traces.length >= 60); assert.ok(data.traces.every((t) => t.libs.length)); });
