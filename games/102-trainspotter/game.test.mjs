import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { buildChoices } from './game.js';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('data sanity', () => {
  assert.ok(data.photos.length >= 60);
  for (const p of data.photos) {
    assert.ok(data.models.some((m) => m.id === p.model));
    assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
  }
});

test('buildChoices has 4 distinct options including the answer', () => {
  const r = makeRng('t');
  for (const m of data.models) {
    const o = buildChoices(data.models, m, 'op', 3, r);
    assert.equal(new Set(o).size, 4);
    assert.ok(o.includes(m.op));
  }
});
