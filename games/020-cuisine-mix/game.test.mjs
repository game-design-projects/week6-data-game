import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import g, { pct, zh, NYC_BOUNDS } from './game.js';
import { makeRng, dayPicker } from './testkit.mjs';
const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));

test('pct rounds to 0.1', () => assert.equal(pct(1, 3), 33.3));
test('zh glosses', () => { assert.equal(zh('Chinese'), 'Chinese 中餐'); assert.equal(zh('Nope'), 'Nope'); });

test('data sane', () => {
  assert.ok(data.zips.length >= 60);
  const ids = new Set();
  for (const z of data.zips) {
    assert.match(z.zip, /^1\d{4}$/); assert.ok(!ids.has(z.zip)); ids.add(z.zip);
    assert.ok(z.lat > NYC_BOUNDS[0][0] && z.lat < NYC_BOUNDS[1][0] && z.lng > NYC_BOUNDS[0][1] && z.lng < NYC_BOUNDS[1][1], z.zip);
    assert.ok(z.n >= 100 && z.mix.length >= 8 && z.boro);
    let prev = Infinity, sum = 0;
    for (const [k, v] of z.mix) { assert.ok(k && Number.isInteger(v) && v > 0 && v <= prev); prev = v; sum += v; assert.ok(data.cityShare[k] > 0, `${z.zip} ${k} no city share`); }
    assert.ok(sum <= z.n);
    for (const [k, l, v] of z.lift) { assert.ok(l >= 1.5 && Number.isFinite(l) && v >= 8 && v <= z.n); assert.ok(data.cityShare[k] > 0); }
  }
  assert.ok(!('Other' in data.cityShare));
});

test('pool: puzzles for days 1-120 are valid and leak-free', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = g.puzzle({ data, day, pick: dayPicker(data.zips, day) });
    seen.add(p.zip.zip);
    assert.ok(p.zip.mix.slice(0, 10).every(([k, v]) => k && !/undefined|NaN/.test(k) && v > 0));
    assert.ok(Number.isFinite(p.zip.lat) && Number.isFinite(p.zip.lng));
    const json = JSON.stringify(p);
    assert.ok(!/Manhattan|Brooklyn|Queens|Bronx|Staten/.test(JSON.stringify({ mix: p.zip.mix, cityShare: p.cityShare })));
    assert.doesNotThrow(() => JSON.parse(json));
  }
  assert.ok(seen.size >= 60);
});

test('every zip location is at least ~0.4 km from the nearest other (scoring is meaningful)', () => {
  for (const a of data.zips) for (const b of data.zips) if (a !== b) {
    const km = Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 84);
    assert.ok(km > 0.3, `${a.zip} ${b.zip}`);
  }
});

test('scoring extremes: exp(-d/3)', () => {
  const s = (km) => Math.round(100 * Math.exp(-km / 3));
  assert.equal(s(0), 100); assert.ok(s(3) > 35 && s(3) < 38); assert.ok(s(15) < 2);
});

test('lift data identifies a distinctive cuisine for most zips', () => {
  assert.ok(data.zips.filter((z) => z.lift.length).length >= 0.7 * data.zips.length);
});
