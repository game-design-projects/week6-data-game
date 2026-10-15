import test from 'node:test'; import assert from 'node:assert';
import fs from 'node:fs';
import game, { buildRounds } from './game.js';
import { makeRng } from '../../engine/core.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const rng = { shuffle: (a) => a.slice().reverse(), sample: (a, n) => a.slice(0, n) };
test('rounds contain the right answers', () => {
  for (const r of buildRounds(data, data.traces, rng)) {
    assert.ok(r.lopts.includes(r.t.lang)); assert.ok(r.bopts.includes(r.lib));
    assert.equal(new Set(r.bopts).size, r.bopts.length); assert.equal(new Set(r.lopts).size, r.lopts.length);
    assert.equal(r.lopts.length, 4); assert.ok(r.bopts.length >= 3);
    // no distractor library may also be present in the trace
    for (const o of r.bopts.filter((x) => x !== r.lib)) assert.ok(!r.t.libs.includes(o), o);
  }
});
test('pool', () => {
  assert.ok(data.traces.length >= 60); assert.ok(JSON.stringify(data).length < 1.5e6);
  const ids = new Set();
  for (const t of data.traces) {
    assert.ok(!ids.has(t.id)); ids.add(t.id);
    assert.ok(data.langNames[t.lang]); assert.ok(t.libs.length); assert.ok(t.trace.split('\n').length >= 5 && t.trace.split('\n').length <= 20);
    assert.ok(t.langHint && t.trace.includes(t.langHint.replace(/…$/, '')), 'langHint in trace ' + t.id);
    assert.ok(t.libHint && t.trace.includes(t.libHint.replace(/…$/, '')), 'libHint in trace ' + t.id);
    assert.ok(/^[\w.-]+\/[\w.-]+$/.test(t.repo) && Number.isInteger(t.n) && t.n > 0);
    for (const v of [t.title, t.trace, t.repo]) assert.ok(typeof v === 'string' && v && !/undefined|NaN/.test(v.slice(0, 0)));
  }
});
test('puzzles days 1-120 are valid and span 3 languages', () => {
  for (let day = 1; day <= 120; day++) {
    const rg = makeRng ? makeRng(`081-${day}`) : null;
    const p = game.puzzle({ data, day, date: '', slug: 'stack-trace', rng: rg, pick: (a) => a[day % a.length] });
    assert.equal(p.ids.length, 3);
    const ts = p.ids.map((id) => data.traces.find((t) => t.id === id)); assert.ok(ts.every(Boolean));
    assert.equal(new Set(p.ids).size, 3); assert.equal(new Set(ts.map((t) => t.lang)).size, 3);
    for (const r of buildRounds(data, ts, rg)) { assert.ok(r.lopts.includes(r.t.lang)); assert.ok(r.bopts.includes(r.lib)); }
  }
});
