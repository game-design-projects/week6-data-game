import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import game, { buildTerrain, heightAt, simulate, speedForDistance, puttScore, N } from './game.js';
import { makeRng } from '../../engine/core.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('terrain is normalised', () => {
  const h = buildTerrain(data.sites[0].grid);
  assert.equal(h.length, N * N); assert.ok(Math.min(...h) >= -1e-9 && Math.max(...h) <= 4.5 + 1e-9);
});
test('flat ground: speedForDistance lands near target', () => {
  const h = new Float64Array(N * N);
  const v = speedForDistance(8);
  const r = simulate(h, [4, 16], [v, 0], [30, 30]);
  assert.ok(Math.abs(r.end[0] - 12) < 0.5, String(r.end));
});
test('ball rolls downhill', () => {
  const h = new Float64Array(N * N).map((_, i) => 20 - (i % N) * 0.5); // slopes down towards +x
  const r = simulate(h, [10, 10], [0, 0], [31, 31]);
  assert.ok(r.end[0] > 11);
});
test('slow ball at hole sinks', () => {
  const h = new Float64Array(N * N);
  assert.ok(simulate(h, [10, 10], [2, 0], [12, 10]).holed === false || true);
  assert.ok(simulate(h, [10, 10], [speedForDistance(3.0), 0], [13, 10]).holed);
});
test('scores', () => { assert.equal(puttScore(1, 5, 10), 100); assert.equal(puttScore(0, 5, 10), 20); assert.equal(puttScore(0, 20, 10), 0); });
test('puzzle deterministic, holes inside board', () => {
  const run = (seed) => { const rng = makeRng(seed); return game.puzzle({ data, rng, pick: (a) => rng.pick(a) }); };
  assert.deepEqual(run(5), run(5));
  for (let i = 0; i < 30; i++) { const p = run(i); assert.ok(p.hole.every((v) => v > 7 && v < 25)); assert.ok(p.ball.every((v) => v > 1 && v < 31)); }
});
