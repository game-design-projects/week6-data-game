import test from 'node:test'; import assert from 'node:assert/strict';
import g, { revealCounts, redactName } from './game.js';
import fs from 'node:fs';
test('revealCounts monotone and ends at N', () => {
  for (const n of [6, 7, 12, 30]) { const c = revealCounts(n); assert.equal(c[5], n); assert.equal(c[0], 3); for (let i = 1; i < 6; i++) assert.ok(c[i] >= c[i - 1]); }
});
test('redact brand words', () => assert.equal(redactName('Coca-Cola flavour', { brand: 'Coca-Cola', name: '可乐' }), '▇▇▇-▇▇▇ flavour'));
test('data pool', () => { const d = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url))); assert.ok(d.products.length >= 40); assert.equal(g.meta.num, 35); });
