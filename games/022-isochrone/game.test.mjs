import test from 'node:test';
import assert from 'node:assert/strict';
import game, { bands, farthest, hull, pinScore } from './game.js';
import data from './data.json' with { type: 'json' };

const rad = Math.PI / 180;
const km = (a, b) => {
  const x = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};

test('bands split at 15 minutes', () => {
  const b = bands([[0, 0, 5, 'a'], [0, 0, 15, 'b'], [0, 0, 20, 'c']]);
  assert.equal(b.near.length, 2);
  assert.equal(b.far.length, 1);
});
test('farthest picks max distance', () => {
  const d = (a, b) => Math.hypot(b.lat - a.lat, b.lng - a.lng);
  const f = farthest({ lat: 0, lng: 0 }, [[1, 1, 1, 'x'], [3, 4, 1, 'y']], d);
  assert.equal(f.s[3], 'y');
  assert.equal(f.d, 5);
});
test('hull drops interior points and dupes', () => {
  const h = hull([[0, 0], [0, 4], [4, 4], [4, 0], [2, 2], [0, 0]]);
  assert.equal(h.length, 4);
  assert.equal(hull([[1, 1], [2, 2]]).length, 2);
});
test('score extremes', () => {
  assert.equal(pinScore(0), 100);
  assert.ok(Math.abs(pinScore(2) - 36.79) < 0.1);
  assert.ok(pinScore(0.5) > 75);
  assert.ok(pinScore(30) < 0.01);
});

test('puzzle pool valid over days 1-120', () => {
  assert.ok(data.puzzles.length >= 60);
  const ids = new Set();
  for (const p of data.puzzles) {
    assert.ok(!ids.has(p.id), 'dup id ' + p.id); ids.add(p.id);
    assert.ok(p.name && typeof p.name === 'string');
    assert.ok(p.lat > 40.4 && p.lat < 41 && p.lng > -74.3 && p.lng < -73.6, p.id);
    assert.ok(p.routes.length > 0);
    assert.ok(p.reached.length >= 18);
    const seen = new Set();
    for (const s of p.reached) {
      assert.equal(s.length, 4);
      assert.ok(s.every((v) => v !== null && v !== undefined && !(typeof v === 'number' && Number.isNaN(v))));
      assert.ok(s[2] >= 0 && s[2] <= 30, p.id);
      assert.ok(s[3].length > 0);
      assert.ok(km(p, { lat: s[0], lng: s[1] }) >= 0.3, `${p.id} has a station on top of the origin`);
      assert.notEqual(s[3], p.name);
      const k = s[0] + ',' + s[1] + s[3];
      assert.ok(!seen.has(k)); seen.add(k);
    }
    assert.ok(bands(p.reached).near.length >= 3, 'too few near points ' + p.id);
  }
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const pick = (a) => a[(day - 1) % a.length];
    const a = game.puzzle({ data, day, date, pick });
    assert.deepEqual(a, game.puzzle({ data, day, date, pick }));
    assert.ok(a.id && Number.isFinite(a.lat) && Number.isFinite(a.lng) && a.reached.length);
  }
});

test('no answer leak: page-visible puzzle fields carry no origin station in reached', () => {
  for (const p of data.puzzles) assert.ok(!p.reached.some((s) => s[3] === p.name));
});
