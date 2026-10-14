import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pctOf, impliedPct } from './game.js';
test('pctOf', () => { assert.equal(pctOf(500, 1000), 50); assert.equal(pctOf(1, 0), 0); });
test('impliedPct', () => { assert.equal(Math.round(impliedPct(100, 9800)), 100); });
test('data sane', () => {
  const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
  assert.ok(d.items.length >= 60);
  for (const x of d.items) assert.ok(Math.abs(pctOf(x.pledged, x.goal) - x.pct) / x.pct < 0.1, x.n);
});
