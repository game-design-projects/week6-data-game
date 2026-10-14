import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupScore, unambiguous } from './game.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));

test('groupScore', () => {
  assert.equal(groupScore(4, 0), 100);
  assert.equal(groupScore(2, 3), 35);
  assert.equal(groupScore(0, 4), 0);
});

test('every puzzle is 4x4 with unique labels', () => {
  assert.ok(data.puzzles.length >= 60);
  for (const p of data.puzzles) {
    assert.equal(p.groups.length, 4);
    assert.ok(p.groups.every((g) => g.items.length === 4));
    assert.ok(unambiguous(p.groups));
  }
});
