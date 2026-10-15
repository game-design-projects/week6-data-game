import test from 'node:test';
import assert from 'node:assert/strict';
import game, { hm, speed, initialGuess, explain, tier } from './game.js';
import data from './data.json' with { type: 'json' };

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
test('hm formats', () => { assert.equal(hm(45), '45 min'); assert.equal(hm(125), '2 h 05 min'); });
test('speed', () => assert.equal(speed(100, 60), 100));
test('meta', () => { assert.equal(game.meta.num, 86); for (const s of game.meta.sources) assert.match(s.url, /^https:\/\//); });

test('pool is large, diverse and sane', () => {
  assert.ok(data.pairs.length >= 60);
  const ops = new Set(data.pairs.map((p) => p.op));
  assert.ok(ops.size >= 3);
  const keys = new Set();
  for (const p of data.pairs) {
    for (const k of ['km', 'min', 'slow', 'n', 'st']) assert.ok(finite(p[k]), `${k} ${p.a.id}`);
    for (const s of [p.a, p.b]) {
      assert.ok(s.id && s.name && !/undefined|NaN/.test(s.name));
      assert.ok(Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180);
    }
    assert.notEqual(p.a.id, p.b.id);
    assert.ok(p.train && p.op);
    assert.ok(p.min >= 25 && p.min <= 3000, 'slider range');
    assert.ok(p.km >= 90 && p.km <= 4000);
    const v = speed(p.km, p.min);
    assert.ok(v >= 20 && v <= 330, `speed ${v}`);
    assert.ok(p.slow >= p.min && p.n >= 1 && p.st >= 0);
    const k = [p.a.id, p.b.id].sort().join('|');
    assert.ok(!keys.has(k), `duplicate ${k}`); keys.add(k);
  }
});

test('puzzle() valid for days 1-120 and nothing visible pre-guess names the answer', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const rng = { };
    const pick = (arr) => arr[(day * 7919) % arr.length];
    const { p } = game.puzzle({ data, day, date, slug: 'rail-time', rng, pick });
    assert.ok(finite(p.min) && p.min > 0);
    seen.add(p.a.id + p.b.id);
    // visible before guessing: station names, km, operator. Must not contain the answer or the train name.
    const visible = `${p.a.name} ${p.b.name} ${p.km} ${p.op}`;
    assert.ok(!visible.includes(p.train));
    assert.ok(!/undefined|NaN|null/.test(JSON.stringify(p)));
    assert.ok(explain(p).length > 20);
  }
  assert.ok(seen.size >= 30);
});

test('scoring: the free default guess is beatable but not hopeless', () => {
  // log scoring, scale .3: score = 100*exp(-|ln(g/a)|/ (0.3/ln2*... )) approximated via ratio buckets
  const ratio = (p) => Math.max(initialGuess(p.km) / p.min, p.min / initialGuess(p.km));
  const close = data.pairs.filter((p) => ratio(p) <= 1.35).length / data.pairs.length;
  const far = data.pairs.filter((p) => ratio(p) >= 2).length / data.pairs.length;
  assert.ok(close < 0.35, `default too good: ${close}`);
  assert.ok(far > 0.25, `default too uniform: ${far}`);
  assert.ok(tier(40) === 0 && tier(200) === 3);
});

test('data and copy are English (no CJK)', () => {
  assert.ok(!/[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/.test(JSON.stringify(data) + JSON.stringify(game.meta)));
});
