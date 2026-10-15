import test from 'node:test';
import assert from 'node:assert/strict';
import { worstDip, at, firstAbove } from './game.js';
const pts = [[1800, 500, 30], [1802, 520, 32], [1804, 530, 25], [1806, 600, 40]];
test('worstDip', () => assert.deepEqual(worstDip(pts), { drop: 7, year: 1804 }));
test('at', () => assert.equal(at(pts, 1803)[0], 1802));
test('firstAbove', () => { assert.equal(firstAbove(pts, 35), 1806); assert.equal(firstAbove(pts, 90), null); });
import game, { pattern, why } from './game.js';
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const I = (d) => ({ data, day: d, date: '2026-10-01', slug: 'trajectory', rng: null, pick: (a) => a[(d - 1) % a.length] });
test('pool: puzzles for days 1-120 valid', () => {
  const ccs = new Set(), ids = new Set();
  for (const c of data.countries) {
    assert.ok(!ids.has(c.cc), 'dup ' + c.cc); ids.add(c.cc);
    assert.match(c.cc, /^[A-Z]{2}$/); assert.ok(c.name && c.name.trim() === c.name);
    assert.ok(['africa', 'americas', 'asia', 'europe'].includes(c.region));
    assert.equal(c.pts.length, 109);
    assert.equal(c.pts[0][0], 1800); assert.equal(c.pts.at(-1)[0], 2015);
    for (const [y, inc, l] of c.pts) {
      assert.ok(Number.isFinite(y) && Number.isFinite(inc) && Number.isFinite(l));
      assert.ok(inc >= 100 && inc <= 200000, `${c.cc} income ${inc}`);
      assert.ok(l >= 0 && l <= 90, `${c.cc} lex ${l}`);
    }
  }
  for (let d = 1; d <= 120; d++) {
    const p = game.puzzle(I(d));
    assert.ok(ids.has(p.cc)); ccs.add(p.cc);
  }
  assert.ok(ccs.size >= 60);
});
test('every label is unique and is not a bare code', () => {
  const seen = new Set();
  for (const c of data.countries) { assert.ok(c.name && c.name !== c.cc && !seen.has(c.name), c.cc); seen.add(c.name); }
});
test('why/pattern', () => {
  const p = pattern([[1800, 500, 30], [1850, 1100, 35], [1900, 1200, 20], [2015, 5000, 70]]);
  assert.equal(p.takeoff, 1850); assert.equal(p.dip.year, 1900);
  assert.match(why('X', p), /1900/);
});
