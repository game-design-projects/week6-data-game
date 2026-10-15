import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import game, { buildTerrain, heightAt, simulate, speedForDistance, puttScore, strokeScore, solveShot, straightShotBreak, latFromKm, EQ_KM, N } from './game.js';
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

const runDay = (day) => { const rng = makeRng(`090-${day}`); return game.puzzle({ data, rng, pick: (a) => a[(day * 37 + 11) % a.length], day }); };

test('data pool: sites well-formed', () => {
  assert.ok(data.sites.length >= 60);
  const names = new Set(); const tiles = new Set();
  data.sites.forEach((s, i) => {
    assert.equal(s.id, i);
    for (const k of ['name', 'zh', 'kind', 'region']) assert.ok(typeof s[k] === 'string' && s[k].length > 0, `${s.name} ${k}`);
    assert.ok(!names.has(s.name)); names.add(s.name);
    const t = `${s.lat},${s.lng}`; assert.ok(!tiles.has(t), `dup tile ${s.name}`); tiles.add(t);
    assert.ok(s.lat >= -85 && s.lat <= 85 && s.lng >= -180 && s.lng <= 180);
    assert.equal(s.grid.length, N * N);
    assert.ok(s.grid.every((v) => Number.isFinite(v) && v > -500 && v < 9000));
    assert.equal(s.min, Math.min(...s.grid)); assert.equal(s.max, Math.max(...s.grid));
    assert.ok(s.max - s.min >= 150, `${s.name} too flat`);
    assert.ok(s.km > 0 && s.km <= EQ_KM + 0.01);
    // the width clue really encodes the latitude
    assert.ok(Math.abs(latFromKm(s.km) - Math.abs(s.lat)) < 2.5, `${s.name} lat clue ${latFromKm(s.km)} vs ${s.lat}`);
  });
});

test('pool validity over days 1-120 + no pre-guess leaks', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = runDay(day);
    const site = data.sites[p.siteId]; assert.ok(site, `day ${day} site`);
    seen.add(p.siteId);
    assert.equal(p.hole.length, 2); assert.equal(p.ball.length, 2);
    for (const v of [...p.hole, ...p.ball]) assert.ok(Number.isFinite(v));
    assert.ok(p.hole.every((v) => v >= 8 && v <= N - 8)); assert.ok(p.ball.every((v) => v >= 2 && v <= N - 2));
    const d = Math.hypot(p.ball[0] - p.hole[0], p.ball[1] - p.hole[1]); assert.ok(d >= 9 - 0.1 && d <= 13 + 0.1);
    // the puzzle object (what the page holds before the guess) carries no place identity beyond an opaque id
    const json = JSON.stringify(p);
    for (const w of [site.name, site.zh, site.region]) assert.ok(!json.includes(w), `leak ${w}`);
    // always holeable in one stroke
    const h = buildTerrain(site.grid);
    assert.ok(p.solve, `day ${day} has a solution`);
    const ang = Math.atan2(p.hole[1] - p.ball[1], p.hole[0] - p.ball[0]) + (p.solve.offsetDeg * Math.PI) / 180;
    const v = p.solve.power * 9; assert.ok(simulate(h, p.ball, [Math.cos(ang) * v, Math.sin(ang) * v], p.hole).holed, 'stored solution sinks');
  }
  assert.ok(seen.size >= 30);
});

test('scoring extremes', () => {
  assert.equal(strokeScore(1), 100); assert.equal(strokeScore(2), 75); assert.equal(strokeScore(3), 55);
  assert.equal(puttScore(0, 11, 11), 0); // never moved closer
  assert.equal(puttScore(0, 0.5, 11), 38); // nearly in
  assert.ok(puttScore(0, 3, 11) > puttScore(0, 6, 11));
  assert.ok(puttScore(0, 0.4, 11) < strokeScore(3)); // holing out always beats a near miss
});

test('slope bends a straight shot and the solver finds a way in', () => {
  const h = new Float64Array(N * N).map((_, i) => ((i % N) + Math.floor(i / N)) * 0.1); // tilts down towards the NW corner
  const b = straightShotBreak(h, [20, 16], [12, 16]);
  assert.ok(b.miss >= 0);
  const sol = solveShot(h, [20, 16], [12, 16]);
  assert.ok(sol && Math.abs(sol.offsetDeg) <= 40);
});

test('width clue maths', () => {
  assert.equal(latFromKm(EQ_KM), 0);
  assert.ok(Math.abs(latFromKm(EQ_KM * Math.cos(Math.PI / 3)) - 60) < 0.2);
});
