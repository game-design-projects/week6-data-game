import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dir, shapeOf } from './game.js';
test('dir', () => { assert.equal(dir(30, 40), '↑'); assert.equal(dir(40, 30), '↓'); assert.equal(dir(30, 31, 1.5), '✓'); });
test('shapeOf', () => { assert.match(shapeOf({ med: 17 }), /真金字塔/); assert.match(shapeOf({ med: 45 }), /老龄/); });
test('data sanity', () => {
  const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
  assert.ok(d.countries.length >= 60);
  for (const c of d.countries) { const s = [...c.f, ...c.m].reduce((a, b) => a + b, 0); assert.ok(Math.abs(s - 100) < 1.5, c.id); }
});
