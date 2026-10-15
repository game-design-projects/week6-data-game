import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import g, { northOf, closestCall, lesson, latLabel } from './game.js';
import { makeRng, dailyIndex, jaccard, isoFromDay } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const puz = (day) => g.puzzle({ data, day, date: isoFromDay(day), slug: 'parallel', rng: makeRng(`parallel:${day}`), pick: (a) => a[dailyIndex('parallel', day, a.length)] });

test('northOf', () => {
  assert.deepEqual(northOf({ lat: 40.7 }, [{ lat: 41.9 }, { lat: 35 }, { lat: 50 }]), [0, 2]);
  assert.deepEqual(northOf({ lat: -34 }, [{ lat: -12 }, { lat: -40 }]), [0]);
});

test('lesson names the closest call', () => {
  const ref = { name: '纽约', lat: 40.7, lng: -74 };
  const c = [{ name: '罗马', country: '意大利', lat: 41.9, lng: 12.5 }, { name: '开罗', country: '埃及', lat: 30, lng: 31 }];
  assert.equal(closestCall(ref, c).name, '罗马');
  const s = lesson(ref, c);
  assert.match(s, /罗马/); assert.match(s, /更靠北/); assert.match(s, /1\.2°/);
  assert.equal(latLabel(-12.04), '南纬12.0°');
});

test('pool validity, days 1-120', () => {
  const ids = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = puz(day);
    assert.equal(p.rounds.length, 3);
    const names = new Set();
    p.rounds.forEach(({ ref, cands }, ri) => {
      assert.equal(cands.length, 5);
      const all = [ref, ...cands];
      for (const c of all) {
        assert.ok(c.name && /^[一-鿿·]+$/.test(c.name), `zh name ${c.name}`);
        assert.ok(c.country && !/^[A-Z]{2}$/.test(c.country), `country ${c.country}`);
        assert.ok(/^[A-Z]{2}$/.test(c.cc));
        assert.ok(Number.isFinite(c.lat) && Math.abs(c.lat) < 66 && Number.isFinite(c.lng) && Math.abs(c.lng) <= 180);
        assert.ok(!names.has(c.name), `duplicate city ${c.name} on day ${day}`);
        names.add(c.name);
      }
      assert.equal(new Set(cands.map((c) => c.cc)).size, 5, 'distinct countries');
      assert.equal(new Set(cands.map((c) => c.lat)).size, 5);
      const n = northOf(ref, cands).length;
      assert.ok(n >= 1 && n <= 4, `north count ${n}`);
      const minGap = Math.min(...cands.map((c) => Math.abs(c.lat - ref.lat)));
      assert.ok(minGap >= 0.4, 'gap');
      if (ri === 0) assert.ok(minGap >= 3, 'round 1 is easy');
      // no answer leak in visible strings before the guess: labels must not contain latitude digits
      for (const c of cands) assert.ok(!/\d/.test(c.name + c.country));
    });
    ids.add(JSON.stringify(p));
  }
  assert.ok(ids.size >= 60);
});

test('scoring extremes (Jaccard)', () => {
  const correct = [0, 2];
  assert.equal(jaccard([0, 2], correct), 1);
  assert.equal(jaccard([1, 3, 4], correct), 0);
  assert.equal(jaccard([0, 1, 2, 3, 4], correct), 0.4); // select-all is penalised
  assert.equal(jaccard([0], correct), 0.5);
});

test('data size', () => {
  assert.ok(fs.statSync(new URL('./data.json', import.meta.url)).size < 1.5e6);
});
