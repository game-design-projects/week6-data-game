import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { rankRoutes } from './game.js';
import { lambert, departDv, flybyDv, MU_SUN } from './build/astro.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('rankRoutes sorts by dv', () => {
  assert.deepEqual(rankRoutes([{ via: 'venus', dv: 3 }, { via: null, dv: 2 }, { via: 'mars', dv: 5 }]), ['direct', 'venus', 'mars']);
});

test('lambert reproduces a circular quarter orbit', () => {
  const R = 1.496e8, v = Math.sqrt(MU_SUN / R), T = (2 * Math.PI * R) / v;
  const s = lambert([R, 0, 0], [0, R, 0], T / 4);
  assert.ok(s);
  assert.ok(Math.abs(Math.hypot(...s.v1) - v) / v < 0.4);
  const h = lambert([R, 0, 0], [0, 1.52 * R, 0], 0.5 * T); // sanity: finite result
  assert.ok(h && isFinite(h.v1[0]));
});

test('departure burn and flyby cost behave', () => {
  assert.ok(Math.abs(departDv(0) - 3.2) < 0.1);
  assert.ok(Math.abs(flybyDv([3, 0, 0], [0, 3, 0], 'venus')) < 1e-6); // equal magnitudes, feasible turn -> free
  assert.ok(flybyDv([3, 0, 0], [0, 6, 0], 'venus') > 0.5);
});

test('puzzle deterministic and data sane', () => {
  assert.ok(data.puzzles.length >= 60);
  for (const p of data.puzzles) assert.ok(p.routes.length >= 3 && new Set(p.routes.map((r) => r.dv)).size === p.routes.length);
  const a = game.puzzle({ data, pick: (x) => x[3] });
  assert.equal(a.id, data.puzzles[3].id);
});
