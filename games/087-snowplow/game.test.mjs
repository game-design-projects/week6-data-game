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

// ---- pool validity (days 1..120) ----
import { readFileSync } from 'node:fs';
import game, { pairs } from './game.js';
import { greedy } from './plow.js';
const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
import { mulberry } from './pool-rng.mjs';

test('pool has >= 60 playable puzzles and data refs line up', () => {
  assert.ok(pairs(data).length >= 60);
  for (const a of data.areas) assert.equal(data.refs[a.id].length, data.storms[a.city].length);
});
test('every puzzle for days 1..120 is valid', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: 'snowplow', rng: mulberry(day), pick: (arr) => arr[(day - 1) % arr.length] });
    const a = data.areas.find((x) => x.id === p.area);
    assert.ok(a, `area ${p.area}`);
    seen.add(p.area + p.storm.d);
    assert.ok(p.storm.snow >= 3 && p.storm.snow < 60 && /^\d{4}-\d\d-\d\d$/.test(p.storm.d));
    assert.ok(p.ref.time > 0.5 && p.ref.time < 120 && p.ref.plowMin <= p.ref.time && Number.isFinite(p.ref.greedy ?? 0));
    const req = a.edges.map((e, i) => (e[3] ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual([...new Set(p.ref.seq.map((s) => s[0]))].sort((x, y) => x - y), req, 'ref covers every priority edge');
    // reference replays to its stored time
    assert.ok(Math.abs(simulate(a, adjacency(a), p.storm.snow, p.ref.seq).time - p.ref.time) < 0.02);
    for (const e of a.edges) assert.ok(e[0] < a.nodes.length && e[1] < a.nodes.length && e[2] > 0 && e[2] < 2000 && (e[3] === 0 || e[3] === 1));
    for (const n of a.nodes) assert.ok(n.every(Number.isFinite));
    assert.ok(a.depot >= 0 && a.depot < a.nodes.length);
  }
  assert.ok(seen.size >= 100);
});
test('areas are connected (every node reachable from the depot)', () => {
  for (const a of data.areas) {
    const adj = adjacency(a), seen = new Set([a.depot]), q = [a.depot];
    while (q.length) for (const [v] of adj[q.pop()]) if (!seen.has(v)) { seen.add(v); q.push(v); }
    assert.equal(seen.size, a.nodes.length, a.id);
  }
});
test('scoring extremes: perfect, typical greedy, worst', () => {
  assert.equal(scoreFor(10, 10), 100);
  assert.equal(scoreFor(10 * 1.5, 10), 0);
  assert.equal(scoreFor(100, 10), 0);
  let sum = 0, n = 0;
  for (const a of data.areas) for (const r of data.refs[a.id]) {
    if (r.greedy / r.time < 1.03) continue;
    const s = scoreFor(r.greedy, r.time); sum += s; n++;
    assert.ok(s < 100 && s > 20, `${a.id} greedy ${s}`);
  }
  assert.ok(sum / n < 92 && sum / n > 50, `mean greedy ${sum / n}`);
});
test('no puzzle text leaks anything odd', () => {
  assert.ok(game.meta.howTo.every((s) => s.length > 5));
  assert.ok(!/undefined|NaN/.test(JSON.stringify(game.meta)));
});
