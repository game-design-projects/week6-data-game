import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { pickRivals, scaleStages, N_DUELS } from './game.js';
const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const mkRng = (seed) => {
  let s = seed;
  const f = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return { sample: (a, n) => { const b = [...a]; const o = []; while (o.length < n) o.push(b.splice(Math.floor(f() * b.length), 1)[0]); return o; } };
};
test('rivals differ enough and are distinct', () => {
  const t = data.counties[5];
  const r = pickRivals(data.counties, t, mkRng(1));
  assert.equal(r.length, N_DUELS);
  assert.equal(new Set(r).size, N_DUELS);
  for (const x of r) { const g = Math.abs(x.fmr[2] - t.fmr[2]) / t.fmr[2]; assert.ok(g >= 0.08 && g <= 0.6); }
});
test('data sane', () => {
  assert.ok(data.counties.length > 1000);
  for (const c of data.counties) assert.ok(c.fmr.every((v, i, a) => i === 0 || v >= a[i - 1]));
});
test('scoring extremes total 100', () => {
  const [pe, pd] = scaleStages({ score: 100, max: 100 }, { score: N_DUELS, max: N_DUELS });
  assert.equal(pe.score + pd.score, 100);
  assert.equal(pe.max + pd.max, 100);
  const [we, wd] = scaleStages({ score: 0, max: 100 }, { score: 0, max: N_DUELS });
  assert.equal(we.score + wd.score, 0);
  const [te, td] = scaleStages({ score: 60, max: 100 }, { score: 2, max: N_DUELS });
  assert.equal(te.score + td.score, 58);
});
test('pool valid over days 1-120', () => {
  const asked = new Set();
  for (let day = 1; day <= 120; day++) {
    const rng = mkRng(day);
    const pick = (a) => a[(day * 7919) % a.length];
    const p = game.puzzle({ data, day, pick, rng });
    const c = data.counties[p.i];
    assert.ok(c, `day ${day}`);
    asked.add(p.i);
    assert.equal(p.rivals.length, N_DUELS);
    assert.equal(new Set(p.rivals).size, N_DUELS);
    assert.ok(!p.rivals.includes(p.i));
    for (const i of p.rivals) assert.notEqual(data.counties[i].fmr[2], c.fmr[2]);
    for (const k of ['st', 'name', 'area']) assert.ok(typeof c[k] === 'string' && c[k].length, k);
    assert.ok(Number.isFinite(c.pop) && c.pop >= 40000);
    assert.ok(c.fmr.length === 5 && c.fmr.every((v) => Number.isFinite(v) && v >= 300 && v <= 5000));
    assert.ok(data.stateMed[c.st] > 0);
    assert.doesNotMatch(JSON.stringify(p), /undefined|NaN/);
  }
  assert.ok(asked.size > 100);
});
test('meta', () => { assert.equal(game.meta.num, 31); assert.equal(game.meta.data, 'snapshot'); });
