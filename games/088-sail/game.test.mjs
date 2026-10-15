import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { boatSpeed, model, optimalRoute, routeHours, scoreFor, toPuzzle, toPuzzleObj, gridUrl, difficulty, explain, meanWind, MAX_WP, HOURS, MEAN_RANGE } from './game.js';
import { dailyIndex } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const fixture = JSON.parse(readFileSync(new URL('./build/fixture.json', import.meta.url)));
const mkPuzzle = (day) => game.puzzle({ data, day, slug: 'sail', pick: (a) => a[dailyIndex('sail', day, a.length)] });
const pool = Array.from({ length: 120 }, (_, i) => mkPuzzle(i + 1));

test('upwind is slower than a reach, and tacking is continuous at 45deg', () => {
  assert.ok(boatSpeed(15, 90) > boatSpeed(15, 10));
  assert.ok(Math.abs(boatSpeed(15, 44.999) - boatSpeed(15, 45)) < 0.01);
  assert.ok(boatSpeed(0, 90) > 0);
  assert.ok(boatSpeed(30, 90) <= boatSpeed(12, 90) * 1.01, 'speed saturates when reefed');
});

test('scoring extremes: perfect, typical, worst', () => {
  assert.equal(scoreFor(10, 10), 100);
  assert.equal(scoreFor(10, 8), 100);
  assert.equal(scoreFor(10, 11), 75); // 10% slower
  assert.equal(scoreFor(10, 20), 13); // twice as slow
  assert.equal(scoreFor(10, 100), 0);
  assert.equal(scoreFor(10, null), 0);
});

test('pool: 120 days give valid, mostly distinct puzzles', () => {
  assert.ok(data.puzzles.length >= 60, `pool size ${data.puzzles.length}`);
  const seen = new Set();
  const first = pool.slice(0, data.puzzles.length).map((p) => p.strait.id + p.when);
  assert.equal(new Set(first).size, first.length, 'no repeats until the pool is used up');
  for (const p of pool) {
    const st = p.strait;
    assert.ok(st && st.id && st.name);
    assert.ok(/^\d{4}-\d\d-\d\d$/.test(p.when));
    assert.equal(p.w.length, HOURS.length);
    for (const f of p.w) {
      assert.equal(f.length, p.n * p.n);
      for (const [s, d] of f) { assert.ok(Number.isInteger(s) && s >= 0 && s <= 80, `speed ${s}`); assert.ok(Number.isInteger(d) && d >= 0 && d < 360, `dir ${d}`); }
    }
    assert.ok(p.mean >= MEAN_RANGE[0] && p.mean <= MEAN_RANGE[1] && p.mean === meanWind(p.w));
    assert.equal(st.mask.length, st.mw * st.mh);
    assert.match(st.mask, /^[01]+$/);
    const [s, w, n, e] = st.box;
    assert.ok(s < n && w < e && s >= -90 && n <= 90);
    for (const pt of [st.a, st.b]) {
      assert.ok(pt.name && pt.lat > s && pt.lat < n && pt.lng > w && pt.lng < e, `${pt.name} inside box`);
    }
    seen.add(JSON.stringify([p.strait.id, p.when]));
  }
  assert.ok(seen.size >= 60, `distinct puzzles in 120 days: ${seen.size}`);
});

test('ports are in water and every pool puzzle is reachable, non-trivial and benchmarked by <= 5 waypoints', () => {
  for (const q of data.puzzles) {
    const p = toPuzzleObj(data, q), m = model(p);
    assert.ok(!m.land(...m.A) && !m.land(...m.B), `ports of ${p.strait.id} must be sea`);
    const o = optimalRoute(m);
    assert.ok(Number.isFinite(o.hours) && o.hours > 0.5 && o.hours < 80, `hours ${o.hours} ${p.strait.id} ${p.when}`);
    assert.deepEqual(o.path[0], m.A);
    assert.deepEqual(o.path.at(-1), m.B);
    assert.ok(o.path.length - 2 <= MAX_WP);
    assert.ok(Math.abs(routeHours(m, o.path) - o.hours) < 1e-9);
    const d = routeHours(m, [m.A, m.B]);
    if (d != null) { assert.ok(o.hours <= d + 1e-6); assert.ok(scoreFor(o.hours, d) < 97, `trivial ${p.strait.id} ${p.when}`); }
  }
});

test('wind changes with time and the optimum depends on departure time', () => {
  const p = pool.find((x) => x.w[0].some((c, i) => Math.abs(c[0] - x.w[3][i][0]) > 4));
  const m = model(p);
  const a = m.wind(m.W / 2, m.H / 2, 0), b = m.wind(m.W / 2, m.H / 2, 18), mid = m.wind(m.W / 2, m.H / 2, 9);
  assert.notDeepEqual(a, b);
  assert.ok(Math.abs(mid[0] - (m.wind(m.W / 2, m.H / 2, 6)[0] + m.wind(m.W / 2, m.H / 2, 12)[0]) / 2) < 1e-9);
  assert.deepEqual(m.wind(5, 5, 99), m.wind(5, 5, 23)); // frozen after the last frame
});

test('land blocks routes', () => {
  const p = pool.find((x) => x.strait.mask.includes('1')), m = model(p), st = p.strait;
  const i = st.mask.indexOf('1'), x = ((i % st.mw) + 0.5) * (m.W / st.mw), y = m.H - (Math.floor(i / st.mw) + 0.5) * (m.H / st.mh);
  assert.ok(m.land(x, y));
  assert.equal(routeHours(m, [m.A, [x, y], m.B]), null);
});

test('no answer leaks: nothing in the puzzle object names the optimal route', () => {
  for (const p of pool) assert.deepEqual(Object.keys(p).sort(), ['hours', 'live', 'mean', 'n', 'strait', 'w', 'when']);
});

test('explain() gives puzzle-specific text', () => {
  const p = pool[3], m = model(p), o = optimalRoute(m), d = routeHours(m, [m.A, m.B]);
  const t = explain(m, p, o, d, { pts: o.path, hours: o.hours });
  assert.ok(t.length >= 3 && t.every((s) => s && !/undefined|NaN/.test(s)));
  assert.match(t[0], /直线航向 \d+°/);
});

test('toPuzzle shapes a live Open-Meteo response (fixture)', () => {
  const q = toPuzzle(fixture.raw, fixture.sIdx, fixture.date);
  assert.equal(q.w.length, HOURS.length);
  assert.equal(q.w[0].length, 81);
  assert.equal(q.live, true);
  assert.ok(q.mean > 0 && q.mean < 60);
  const p = game.puzzle({ data: { ...data, live: q }, day: 15, pick: () => assert.fail('must not pick when live') });
  assert.equal(p.live, true);
  assert.equal(p.when, fixture.date);
  const diff = difficulty(p);
  assert.ok(Number.isFinite(diff.opt) && diff.opt > 0);
  assert.throws(() => toPuzzle(fixture.raw.slice(1), 0, fixture.date), /81/);
  assert.throws(() => toPuzzle(fixture.raw, 0, '2020-01-01'), /no wind/);
  const bad = structuredClone(fixture.raw); bad[5].hourly.wind_speed_10m[2] = null;
  assert.throws(() => toPuzzle(bad, 0, fixture.date), /no wind/);
});

test('gridUrl is well-formed', () => {
  const u = new URL(gridUrl(data.straits[0], 9, '2026-10-14'));
  assert.equal(u.hostname, 'historical-forecast-api.open-meteo.com');
  assert.equal(u.searchParams.get('latitude').split(',').length, 81);
  assert.equal(u.searchParams.get('start_date'), '2026-10-14');
});

test('load(): live fetch with fallback chain', async () => {
  const log = Object.assign(() => {}, { warn() {} });
  const core = { addDays: (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10) };
  const mk = (fetchJSON) => ({ data, date: '2026-10-15', today: '2026-10-15', core, log, pick: (a) => a[data.straits.findIndex((s) => s.id === 'cook')], fetchJSON });
  const ok = await game.load(mk(async () => fixture.raw));
  assert.ok(ok.live && ok.live.date === '2026-10-14' && ok.live.s === data.straits.findIndex((s) => s.id === 'cook'));
  await assert.rejects(game.load(mk(async () => { throw new Error('offline'); })), /snapshot/);
  await assert.rejects(game.load({ ...mk(async () => fixture.raw), date: '2027-01-01' }), /future/);
});
