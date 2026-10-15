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

test('pool valid over days 1-120', () => {
  const ids = new Set();
  for (let day = 1; day <= 120; day++) {
    const pick = (a) => a[(day * 7) % a.length];
    const p = game.puzzle({ data, day, pick });
    const r = data.runners.find((x) => x.id === p.id);
    assert.ok(r, `day ${day}`);
    ids.add(p.id);
    const all = [...r.sp, ...r.rest];
    assert.ok(all.every((v, i) => Number.isFinite(v) && (i === 0 || v > all[i - 1])), `splits ${r.id}`);
    assert.equal(r.rest.at(-1), r.fin);
    assert.ok(r.fin < 6 * 3600 && r.sp[4] > 3600);
    assert.ok(['M', 'F'].includes(r.g) && r.age >= 18 && r.age <= 90 && r.cc && [2015, 2016, 2017].includes(r.y));
    const ratio = r.fin / r.sp[4];
    assert.ok(ratio > 1.5 && ratio < 2.4, `slider range ${r.id}`);
    assert.ok(fadePct(r.sp[4], r.fin) < 41, `unguessable ${r.id}`);
  }
  assert.equal(new Set(data.runners.map((x) => x.id)).size, data.runners.length);
});
test('scoring extremes: 100*exp(-err/5%) (engine pct, scale .05)', () => {
  const sc = (g, a) => 100 * Math.exp(-Math.abs(g - a) / a / 0.05);
  assert.equal(sc(100, 100), 100);
  assert.ok(sc(110, 100) < 15 && sc(104, 100) > 40 && sc(150, 100) < 1);
});
test('no answer leak: game.js never reads fin/rest before play result', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('./game.js', import.meta.url), 'utf8');
  const pre = src.slice(src.indexOf('async play'), src.indexOf('ctx.estimate'));
  assert.ok(!/r\.rest|r\.fin/.test(pre));
});
