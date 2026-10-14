import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('every puzzle has valid coordinates, a description and attribution', () => {
  assert.ok(data.puzzles.length >= 40);
  for (const p of data.puzzles) {
    assert.ok(p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180, `coords ${p.id}`);
    assert.ok(p.desc.length > 30, `desc ${p.id}`);
    assert.ok(p.img.startsWith('https://upload.wikimedia.org/'), `img ${p.id}`);
    assert.ok(p.lic, `license ${p.id}`);
  }
});

test('descriptions do not name the city', () => {
  for (const p of data.puzzles) assert.ok(!p.desc.includes(p.city) && !p.desc.includes(p.country), `leak ${p.id}`);
});

test('puzzle() picks an existing id', () => {
  const ids = new Set(data.puzzles.map((p) => p.id));
  const out = game.puzzle({ data, pick: (a) => a[3] });
  assert.ok(ids.has(out.id));
});
