import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { leftover, explain, MODES } from './game.js';
import { makeRng, dailyIndex, expScore, logError } from '../../engine/core.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
test('shares are sane', () => {
  assert.ok(data.counties.length >= 60);
  const seen = new Set();
  for (const c of data.counties) {
    const s = c.drive + c.carpool + c.transit + c.bike + c.walk + c.wfh + c.other;
    assert.ok(s > 90 && s < 101, `${c.name} sums to ${s}`);
    for (const m of MODES) assert.ok(c[m.key] >= 0.2 && c[m.key] <= 100, `${c.name} ${m.key}`);
    for (const k of ['name', 'state']) assert.ok(c[k] && typeof c[k] === 'string');
    for (const k of ['workers', 'pop', 'drive', 'walk', 'carpool', 'other']) assert.ok(Number.isFinite(c[k]) && c[k] >= 0, `${c.name} ${k}`);
    assert.ok(c.pop >= 1000);
    const id = c.name + c.state; assert.ok(!seen.has(id)); seen.add(id);
    assert.ok(leftover(c) >= c.transit + c.bike + c.wfh - 1, `${c.name} leftover`);
    assert.ok(explain(c, () => 1).length > 20);
  }
});
test('puzzle() valid for days 1-120', () => {
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: 'commute-mode', rng: makeRng(`commute-mode:${day}`), pick: (a) => a[dailyIndex('commute-mode', day, a.length)] });
    assert.ok(Number.isInteger(p.i) && data.counties[p.i], `day ${day}`);
  }
});
test('scoring extremes (engine log scoring, scale 0.35)', () => {
  const sc = (g, a) => expScore(logError(g, a), 0.35);
  assert.equal(sc(5, 5), 100);
  assert.ok(sc(10, 5) > 40 && sc(10, 5) < 60); // 2x off
  assert.ok(sc(0.1, 100) < 5); // worst case
  assert.ok(sc(5, 5.5) > 85); // close guess rewarded
});
