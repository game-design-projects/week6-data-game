import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { profile, lines, shortName } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('lines / shortName parse station labels', () => {
  assert.equal(lines('Hewes St (M,J)'), 'M,J');
  assert.equal(shortName('Hewes St (M,J)'), 'Hewes St');
});

test('profile classifies commuter patterns', () => {
  const wk = Array(24).fill(100); wk[8] = 1000; wk[17] = 200;
  const p = profile({ wk, we: Array(24).fill(50) });
  assert.equal(p.peakWk, 8);
  assert.match(p.kind, /居民区/);
  const q = profile({ wk: wk.map((_, i) => (i === 17 ? 1000 : 100)), we: Array(24).fill(50) });
  assert.match(q.kind, /办公区/);
});

test('data: unique labels, 24-hour arrays, pool size', () => {
  assert.ok(data.stations.filter((s) => s.pool).length >= 60);
  assert.equal(new Set(data.stations.map((s) => s.name)).size, data.stations.length);
  for (const s of data.stations) { assert.equal(s.wk.length, 24); assert.equal(s.we.length, 24); }
});
