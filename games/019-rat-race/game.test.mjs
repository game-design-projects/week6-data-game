import { test } from 'node:test';
import assert from 'node:assert/strict';
import game, { buildPairs } from './game.js';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

function mkrng(seed) { let s = seed; const f = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return { shuffle: (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; } }; }

test('pairs: 5 rounds, unique zips, no ties', () => {
  for (const y of ['2019', '2023']) {
    const pairs = buildPairs(data.years[y], mkrng(7));
    assert.equal(pairs.length, 5);
    const flat = pairs.flat();
    assert.equal(new Set(flat).size, 10);
    const m = new Map(data.years[y].map((r) => [r[0], r[1]]));
    for (const [a, b] of pairs) assert.notEqual(m.get(a), m.get(b));
  }
});
