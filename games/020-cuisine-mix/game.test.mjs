import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import g, { pct } from './game.js';
const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
test('pct rounds to 0.1', () => assert.equal(pct(1, 3), 33.3));
test('data sane', () => {
  assert.ok(data.zips.length >= 60);
  for (const z of data.zips) assert.ok(z.lat > 40.4 && z.lat < 41 && z.mix[0][1] <= z.n);
});
test('puzzle shape', () => {
  const pick = (a) => a[0];
  assert.equal(g.puzzle({ data, pick }).zip.zip, data.zips[0].zip);
});
