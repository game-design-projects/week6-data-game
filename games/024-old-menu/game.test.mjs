import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import game from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('pool is large and well-formed', () => {
  assert.ok(data.menus.length >= 60);
  for (const m of data.menus) {
    assert.equal(m.d.length, 4);
    assert.ok(m.y >= 1880 && m.y <= 1990);
    for (const [n, p] of m.d) assert.ok(n && p > 0);
    assert.equal(new Set(m.d.map((x) => x[1])).size, 4);
  }
});

test('puzzle is deterministic', () => {
  const pick = (a) => a[0];
  assert.deepEqual(game.puzzle({ data, pick }), game.puzzle({ data, pick }));
});
