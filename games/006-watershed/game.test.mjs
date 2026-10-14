import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { areaBand, toMulti, regionZh } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('areaBand brackets the value', () => {
  assert.match(areaBand(150e3), /100 千 – 200 千/);
  assert.match(areaBand(5.9e6), /3\.2 百万 – 7 百万/);
  assert.match(areaBand(9e6), /大于/);
});
test('data sanity', () => {
  assert.ok(data.rivers.length >= 60);
  for (const r of data.rivers) {
    assert.ok(r.rings.length > 0, r.id);
    assert.ok(r.area > 50000, r.id);
    assert.ok(Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180, r.id);
  }
  assert.equal(new Set(data.rivers.map((r) => r.id)).size, data.rivers.length);
});
test('toMulti / regionZh', () => {
  const m = toMulti(data.rivers[0]);
  assert.equal(m.type, 'MultiPolygon');
  assert.equal(regionZh('Africa'), '非洲');
});
test('puzzle resolves to a river', () => {
  const p = game.puzzle({ data, pick: (a) => a[3] });
  assert.ok(data.rivers.some((r) => r.id === p.id));
});
