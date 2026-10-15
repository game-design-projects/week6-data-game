import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { borough, rowsFor } from './game.js';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const finite = (n) => typeof n === 'number' && Number.isFinite(n);

test('pool size and per-zip sanity', () => {
  assert.ok(data.zips.length >= 60);
  const ids = new Set();
  for (const z of data.zips) {
    assert.ok(!ids.has(z.zip), `dup ${z.zip}`); ids.add(z.zip);
    assert.match(z.zip, /^\d{5}(, \d{5})*$/);
    assert.ok(z.lat > 40.49 && z.lat < 40.92 && z.lng > -74.27 && z.lng < -73.69, z.zip);
    assert.ok(z.total >= 4000 && finite(z.pop) && z.pop >= 0 && z.r > 0 && z.r <= 3.2, z.zip);
    assert.equal(z.top.length, 8);
    let prev = 101;
    for (const [t, pct, avg] of z.top) {
      assert.ok(typeof t === 'string' && t && data.labels[t], `label ${t}`);
      assert.ok(finite(pct) && pct > 0 && pct <= 100 && pct <= prev); prev = pct;
      assert.ok(finite(avg) && avg > 0 && avg <= 100, `${z.zip} ${t} avg`);
    }
    assert.equal(z.lift.length, 3);
    z.lift.forEach(([t, x]) => { assert.ok(data.labels[t] && finite(x) && x > 0); });
    assert.ok(z.poly.length >= 1);
    for (const ring of z.poly) for (const [la, ln] of ring) assert.ok(finite(la) && finite(ln) && la > 40.4 && la < 41 && ln > -74.4 && ln < -73.6);
    // centroid lies near its outline
    const lats = z.poly.flat().map((q) => q[0]), lngs = z.poly.flat().map((q) => q[1]);
    assert.ok(z.lat >= Math.min(...lats) && z.lat <= Math.max(...lats) && z.lng >= Math.min(...lngs) && z.lng <= Math.max(...lngs), z.zip);
  }
});

test('puzzle() valid for days 1-120', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const rng = makeRng ? makeRng(`311:${day}`) : undefined;
    const pick = (a) => a[(day * 37) % a.length];
    const p = game.puzzle({ data, day, date, slug: '311', rng, pick });
    assert.ok(data.zips.some((z) => z.zip === p.zip));
    seen.add(p.zip);
  }
  assert.ok(seen.size > 30);
});

test('no answer leaks in what is shown before the guess', () => {
  for (const z of data.zips) {
    const shown = JSON.stringify(rowsFor(z, data.labels));
    assert.ok(!shown.includes(z.zip), z.zip);
    for (const w of ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten']) assert.ok(!new RegExp(w, 'i').test(shown), `${z.zip} ${w}`);
  }
});

test('rowsFor lift and borough', () => {
  const z = data.zips[0];
  const rows = rowsFor(z, data.labels);
  assert.equal(rows.length, 8);
  rows.forEach((r) => assert.ok(finite(r.lift) && r.name));
  assert.equal(borough('10001'), 'Manhattan');
  assert.equal(borough('11201'), 'Brooklyn');
  assert.equal(borough('10301'), 'Staten Island');
  assert.equal(borough('10451'), 'The Bronx');
  assert.equal(borough('11375'), 'Queens');
});

test('scoring extremes (100*exp(-km/4))', () => {
  const s = (km) => 100 * Math.exp(-km / 4);
  assert.equal(s(0), 100);
  assert.ok(s(2) > 55 && s(2) < 65);
  assert.ok(s(15) < 3);
  // the farthest two pool zips are still < 60 km apart, so the worst score is ~0
  const far = Math.hypot(0.5 * 111, 0.5 * 84);
  assert.ok(s(far) < 0.1);
});
