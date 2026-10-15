import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import game, { buildCourse, simulate, botJumps, scoreRun, newRun, step, jumpBudget } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const per = (c, T) => { const s = newRun(); let t = 0, nx = 0; while (!s.done) { const j = t >= nx; if (j) nx += T; step(c, s, 1 / 60, j); t += 1 / 60; } return s; };

test('pool: 240 unique, well-formed days', () => {
  const seen = new Set();
  for (const d of data.days) {
    const key = d.sym + d.date; assert.ok(!seen.has(key), 'dup ' + key); seen.add(key);
    assert.match(d.date, /^\d{4}-\d\d-\d\d$/); assert.ok(d.name && d.sym);
    assert.equal(d.bars.length, data.n);
    assert.ok(d.bars.every((v) => Number.isFinite(v) && v > 100), key);
    assert.ok(new Set(d.bars).size > 10, 'flat ' + key);
  }
  assert.ok(data.days.length >= 60);
});

test('puzzle() valid for every pool entry (days 1-240 cover days 1-120 and more)', () => {
  const mk = (day) => ({ data, day, date: '2026-10-01', slug: 'ticker-runner' });
  // reuse the engine-like seeded pick: any deterministic permutation is fine here, so cycle the pool
  for (let day = 1; day <= 240; day++) {
    const p = game.puzzle({ ...mk(day), rng: null, pick: (a) => a[(day * 7) % a.length] });
    assert.ok(p.bars.length === data.n && p.bars.every(Number.isFinite) && p.name && p.date);
    const c = buildCourse(p.bars);
    assert.ok(c.coins.length === 15 && c.spikes.length === 4, `day ${day}`);
    assert.ok(c.ground.every((g) => g >= 0 && g <= 1));
    const cx = new Set(c.coins.map((q) => q.x)); for (const k of c.spikes) assert.ok(!cx.has(k.x), 'coin on spike');
  }
});

test('every course: bot near-perfect, idle zero, spam jumping and sloppy timing mid', () => {
  const agg = { spam: [], sloppy: [] };
  for (const d of data.days) {
    const c = buildCourse(d.bars);
    assert.equal(scoreRun(c, simulate(c, [])), 0);
    const best = scoreRun(c, simulate(c, botJumps(c)));
    assert.ok(best >= 90, `${d.sym} ${d.date} bot ${best}`);
    agg.spam.push(scoreRun(c, per(c, 0.74)));
    agg.sloppy.push(scoreRun(c, simulate(c, botJumps(c).map((v, i) => v + (i % 2 ? 0.9 : -0.9)))));
  }
  const mean = (a) => a.reduce((x, y) => x + y) / a.length;
  assert.ok(mean(agg.spam) < 55, 'spam ' + mean(agg.spam));
  assert.ok(mean(agg.sloppy) < 70 && mean(agg.sloppy) > 25, 'sloppy ' + mean(agg.sloppy));
});

test('scoring extremes', () => {
  const c = buildCourse(data.days[0].bars);
  const all = { got: new Set(c.coins.map((_, i) => i)), hits: 0, jumps: jumpBudget(c) };
  assert.equal(scoreRun(c, all), 100);
  assert.equal(scoreRun(c, { ...all, hits: 2 }), 80);
  assert.equal(scoreRun(c, { ...all, jumps: jumpBudget(c) + 3 }), 88);
  assert.equal(scoreRun(c, { got: new Set(), hits: 4, jumps: 99 }), 0);
});

test('no spoilers needed: meta copy present', () => {
  assert.ok(game.meta.howTo.length >= 2 && game.meta.dataNote.includes('Access-Control-Allow-Origin'));
  for (const s of game.meta.sources) assert.match(s.url, /^https:\/\//);
});
