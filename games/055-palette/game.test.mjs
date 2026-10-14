import test from 'node:test'; import assert from 'node:assert/strict';
import game, { decade, styleOptions } from './game.js';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const rng = { sample: (a, n) => a.slice(0, n), shuffle: (a) => a };
test('decade', () => assert.equal(decade(1889), '1880s'));
test('styleOptions has answer once, 4 total', () => {
  const o = styleOptions(data.styles, 'Realism', rng);
  assert.equal(o.length, 4); assert.equal(o.filter((x) => x.id === 'Realism').length, 1);
});
test('data sane', () => {
  assert.ok(data.paintings.length >= 60);
  for (const p of data.paintings) { assert.equal(p.colors.length, 5); assert.ok(data.styles.some((s) => s.id === p.style)); }
});
test('meta', () => assert.equal(game.meta.num, 55));
