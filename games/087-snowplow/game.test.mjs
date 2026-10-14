import test from 'node:test';
import assert from 'node:assert/strict';
import { speeds, edgeMinutes, adjacency, newState, goTo, simulate, done, solve, scoreFor } from './plow.js';
import { buildGraph } from './build/build.mjs';

// depot 0 --(req 1000m)-- 1 --(req 1000m)-- 2 ; side street 0--2 (600 m)
const g = { nodes: [[0, 0], [0, 1], [0, 2]], edges: [[0, 1, 1000, 1], [1, 2, 1000, 1], [0, 2, 600, 0]], depot: 0 };

test('speeds shrink with snow depth but have floors', () => {
  assert.ok(speeds(10).plow < speeds(2).plow);
  assert.equal(speeds(100).plow, 5);
  assert.equal(speeds(100).res, 8);
});
test('plowing costs more than driving a cleared road', () => {
  const e = g.edges[0];
  assert.ok(edgeMinutes(e, false, 8) > edgeMinutes(e, true, 8));
});
test('first drive plows, second is fast', () => {
  const adj = adjacency(g);
  const st = newState(g);
  goTo(g, adj, 6, st, 1);
  const t1 = st.time;
  assert.ok(st.cleared[0]);
  goTo(g, adj, 6, st, 0);
  assert.ok(st.time - t1 < t1);
});
test('simulate finishes all priority roads', () => {
  const adj = adjacency(g);
  const st = simulate(g, adj, 6, [[0, 0], [1, 0]]);
  assert.ok(done(g, st));
});
test('solver beats the naive order and is deterministic', () => {
  const r = solve(g, 6), r2 = solve(g, 6);
  const naive = simulate(g, adjacency(g), 6, [[1, 1], [0, 1]]).time; // 2→1 then 1→0: wrong direction
  assert.ok(r.time <= naive);
  assert.equal(r.time, r2.time);
});
test('score bounds', () => {
  assert.equal(scoreFor(10, 10), 100);
  assert.equal(scoreFor(8, 10), 100);
  assert.equal(scoreFor(18, 10), 0);
  assert.equal(scoreFor(10, 10, 2), 90);
});
test('buildGraph contracts degree-2 nodes', () => {
  const osm = { elements: [
    { type: 'node', id: 1, lat: 40, lon: -70 }, { type: 'node', id: 2, lat: 40.0005, lon: -70 }, { type: 'node', id: 3, lat: 40.001, lon: -70 },
    { type: 'node', id: 4, lat: 40.001, lon: -70.001 },
    { type: 'node', id: 5, lat: 40.001, lon: -70.0005 }, { type: 'way', id: 11, nodes: [3, 5], tags: { highway: 'secondary' } },
    { type: 'way', id: 9, nodes: [1, 2, 3], tags: { highway: 'primary' } },
    { type: 'way', id: 10, nodes: [3, 4], tags: { highway: 'primary' } },
  ] };
  const gr = buildGraph(osm, [40.0005, -70.0005], 500);
  assert.equal(gr.edges.length, 3);
  assert.equal(gr.nodes.length, 4);
});
