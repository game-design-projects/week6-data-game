import { test } from 'node:test';
import assert from 'node:assert/strict';
import game, { hms, pace, segPaces, evenProjection, fadePct } from './game.js';
import data from './data.json' with { type: 'json' };

test('hms/pace formatting', () => { assert.equal(hms(3725), '1:02:05'); assert.equal(pace(272), '4:32'); });
test('segPaces', () => assert.deepEqual(segPaces([1500, 3000, 4500, 6000, 7500]), [300, 300, 300, 300, 300]));
test('even projection and fade', () => {
  const t25 = 7500, ev = evenProjection(t25);
  assert.ok(Math.abs(fadePct(t25, ev)) < 1e-9);
  assert.ok(fadePct(t25, ev * 1.1) > 9.9);
});
test('data sane', () => {
  assert.ok(data.runners.length >= 60);
  for (const r of data.runners) { assert.equal(r.sp.length, 5); assert.ok(r.fin > r.sp[4]); }
});
test('puzzle deterministic', () => {
  const pick = (a) => a[0];
  assert.deepEqual(game.puzzle({ data, pick }), game.puzzle({ data, pick }));
});
