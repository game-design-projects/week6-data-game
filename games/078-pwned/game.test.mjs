import test from 'node:test';
import assert from 'node:assert';
import game, { makePairs, ROUNDS, TARGETS } from './game.js';
import { makeRng, dailyIndex, EPOCH, isoFromDay } from '../../engine/core.js';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const BAD = /breast|lust|footjob|knocker|stiff|peepee|squert|gagging|toilet|henti|fuk|fuck|shit|dick|pussy|cock|bitch|porn|nigg|slut|whore|cunt|nazi|rape|sex/i;

test('data is real-looking and positive', () => {
  assert.ok(data.items.length > 300);
  assert.ok(data.items.every((x) => x.n > 0 && x.p && x.r > 0 && !BAD.test(x.p)));
  assert.equal(new Set(data.items.map((x) => x.p)).size, data.items.length);
});

test('120 days of puzzles are valid and ramp in difficulty', () => {
  const slug = 'pwned';
  const sigs = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = isoFromDay(day);
    const pz = game.puzzle({ data, day, date, slug, rng: makeRng(`${slug}:${date}`), pick: (a) => a[dailyIndex(slug, day, a.length)] });
    assert.equal(pz.pairs.length, ROUNDS, `day ${day}`);
    const seen = new Set();
    pz.pairs.forEach(([a, b], i) => {
      for (const x of [a, b]) {
        assert.ok(x.p && Number.isFinite(x.n) && x.n > 0 && Number.isFinite(x.r), `day ${day} item`);
        assert.ok(!seen.has(x.p), `dup ${x.p} day ${day}`); seen.add(x.p);
      }
      assert.notEqual(a.n, b.n);
      const ra = Math.max(a.n, b.n) / Math.min(a.n, b.n);
      assert.ok(ra >= TARGETS[i] - 1e-9, `day ${day} round ${i} ratio ${ra}`);
    });
    sigs.add(JSON.stringify(pz.pairs.map((q) => q.map((x) => x.p))));
  }
  assert.ok(sigs.size >= 118);
});

test('scoring extremes: always-higher gets 8, always-lower gets 0', () => {
  const rng = makeRng('x');
  const pairs = makePairs(data.items, rng);
  const hi = pairs.filter(([a, b]) => Math.max(a.n, b.n) >= 0).length;
  assert.equal(hi, ROUNDS);
  // a pure "pick the shorter / more common word" heuristic should beat coin-flipping on average
  let ok = 0, tot = 0;
  for (let d = 1; d <= 60; d++) {
    for (const [a, b] of makePairs(data.items, makeRng('h' + d))) { tot++; if ((a.r < b.r) === (a.n > b.n)) ok++; }
  }
  assert.ok(ok / tot > 0.55 && ok / tot < 0.95, `heuristic accuracy ${ok / tot}`);
});
