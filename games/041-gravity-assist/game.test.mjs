import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { rankRoutes, blend, culprit, label } from './game.js';
import { lambert, departDv, flybyDv, MU_SUN, position, jdOf, AU, TARGETS, FLYBYS, MIN_GAP, MAX_YEARS } from './astro.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const dateOf = (day) => new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
const pickAt = (day) => (arr) => arr[(day * 7) % arr.length];
const ymd = /^\d{4}-\d{2}-\d{2}$/;

test('rankRoutes sorts by dv', () => {
  assert.deepEqual(rankRoutes([{ via: 'venus', dv: 3 }, { via: null, dv: 2 }, { via: 'mars', dv: 5 }]), ['direct', 'venus', 'mars']);
});

test('lambert reproduces a circular quarter orbit', () => {
  const R = 1.496e8, v = Math.sqrt(MU_SUN / R), T = (2 * Math.PI * R) / v;
  const s = lambert([R, 0, 0], [0, R, 0], T / 4);
  assert.ok(s);
  assert.ok(Math.abs(Math.hypot(...s.v1) - v) / v < 0.4);
});

test('departure burn and flyby cost behave', () => {
  assert.ok(Math.abs(departDv(0) - 3.2) < 0.1);
  assert.ok(Math.abs(flybyDv([3, 0, 0], [0, 3, 0], 'venus')) < 1e-6);
  assert.ok(flybyDv([3, 0, 0], [0, 6, 0], 'venus') > 0.5);
});

test('Keplerian positions agree with the Horizons check points', () => {
  assert.ok(data.check.length >= 60);
  const tol = { mercury: 0.01, venus: 0.01, earth: 0.01, mars: 0.01, jupiter: 0.03, saturn: 0.06 };
  for (const c of data.check) {
    const err = Math.hypot(...position(data.elements, c.body, c.jd).map((x, i) => x / AU - c.r[i]));
    assert.ok(err < tol[c.body], `${c.body} @${c.jd}: ${err.toFixed(4)} AU`);
  }
});

test('earth is ~1 AU from the sun', () => {
  const jd = jdOf('2026-10-15');
  const r = Math.hypot(...position(data.elements, 'earth', jd)) / AU;
  assert.ok(r > 0.99 && r < 1.01);
});

test('puzzle pool, days 1–120: every puzzle is valid', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = dateOf(day);
    const p = game.puzzle({ data, day, date, pick: pickAt(day) });
    const again = game.puzzle({ data, day, date, pick: pickAt(day) });
    assert.deepEqual(p, again, 'deterministic');
    assert.equal(p.date, date);
    assert.ok(TARGETS.includes(p.target));
    assert.equal(p.routes.length, 4);
    const ids = p.routes.map((r) => r.via ?? 'direct');
    assert.equal(new Set(ids).size, 4, 'duplicate route ids');
    assert.ok(!ids.includes(p.target), 'flyby planet equals target');
    assert.deepEqual(ids.slice(1).sort(), FLYBYS[p.target].slice().sort());
    const dvs = p.routes.map((r) => r.dv);
    assert.equal(new Set(dvs).size, 4, 'tied dv');
    for (const r of p.routes) {
      for (const k of ['dv', 'vinf', 'arr', 'years']) assert.ok(Number.isFinite(r[k]) && r[k] > 0, `${k}=${r[k]}`);
      assert.ok(r.dv > 2 && r.dv < 60, `dv ${r.dv}`);
      assert.ok(r.years <= MAX_YEARS + 0.1);
      assert.ok(ymd.test(r.launch) && ymd.test(r.arrive) && r.launch < r.arrive);
      assert.ok(r.launch >= date);
      assert.equal(r.flyby.length, r.via ? 1 : 0);
      assert.equal(!!r.flybyDate, !!r.via);
      if (r.via) assert.ok(r.launch < r.flybyDate && r.flybyDate < r.arrive);
      // total = departure burn + flyby + arrival (rounded)
      assert.ok(Math.abs(r.dv - (departDv(r.vinf) + r.flyby.reduce((a, b) => a + b, 0) + r.arr)) < 0.06, 'dv does not add up');
      assert.ok(!JSON.stringify(r).match(/NaN|undefined|null.*null.*null/));
    }
    seen.add(`${p.target}${dvs.join()}`);
  }
  assert.ok(seen.size >= 100, `only ${seen.size} distinct puzzles`);
});

test('most days respect the 4 % separation rule and targets vary', () => {
  let ok = 0; const targets = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, date: dateOf(day), pick: pickAt(day) });
    const s = p.routes.map((r) => r.dv).sort((a, b) => a - b);
    if (Math.min(...s.slice(1).map((v, i) => v / s[i])) >= MIN_GAP - 0.005) ok++;
    targets.add(p.target);
  }
  assert.ok(ok >= 108, `separated on ${ok}/120 days`);
  assert.ok(targets.size >= 4, [...targets].join());
});

test('the cheapest route varies (not always direct, not always a flyby)', () => {
  const win = {};
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, date: dateOf(day), pick: pickAt(day) });
    const b = rankRoutes(p.routes)[0];
    win[b] = (win[b] ?? 0) + 1;
  }
  assert.ok((win.direct ?? 0) > 10 && (win.direct ?? 0) < 90, JSON.stringify(win));
  assert.ok(Object.keys(win).length >= 3, JSON.stringify(win));
});

test('scoring extremes: perfect, typical, worst', () => {
  assert.equal(blend(100, 100), 100);
  assert.equal(blend(67, 60), 65);
  assert.equal(blend(0, 0), 0);
  assert.ok(blend(100, 0) === 70 && blend(0, 100) === 30);
  assert.ok(blend(33, 0) < blend(67, 0) && blend(67, 0) < blend(100, 0));
});

test('culprit names the dominant extra cost', () => {
  const b = { vinf: 3, flyby: [0], arr: 2 };
  assert.match(culprit({ vinf: 3, flyby: [0], arr: 6 }, b), /arrives too fast/);
  assert.match(culprit({ vinf: 3, flyby: [2.5], arr: 2 }, b), /flyby/);
  assert.match(culprit({ vinf: 6, flyby: [0], arr: 2 }, b), /departure/);
  assert.equal(label({ venus: 'Venus' }, 'venus'), 'Venus flyby');
});
