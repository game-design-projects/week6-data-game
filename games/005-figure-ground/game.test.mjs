import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { decode, stats, temp, axisText, finalScore, HIT_KM } from './game.js';
import { makeRng, dailyIndex } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));

test('decode delta ways', () => {
  assert.deepEqual(decode([[0, 10, 20, 5, -5, 5, 5]])[0].pts, [[10, 20], [15, 15], [20, 20]]);
});
test('perfect grid has gridness ~1, diagonal mix lower', () => {
  const grid = [[0, 0, 0, 100, 0], [0, 0, 0, 0, 100], [1, 50, 50, 100, 0]];
  assert.ok(stats(grid).grid > 0.99);
  const mixed = [[0, 0, 0, 100, 0], [0, 0, 0, 70, 70], [0, 0, 0, 20, 100], [0, 0, 0, 100, 40]];
  assert.ok(stats(mixed).grid < 0.9);
});
test('axis is a compass bearing: a street running north-east-ish gives 45', () => {
  // screen y grows downward, so (dx=+100, dy=-100) points north-east
  const ne = [[1, 0, 500, 100, -100], [1, 0, 600, 100, -100]];
  assert.equal(stats(ne).axis, 45);
  assert.match(axisText(0), /north-south/); assert.match(axisText(30), /east of north/); assert.match(axisText(60), /30° west of north/);
});
test('temp bands', () => { assert.match(temp(10), /Scorching/); assert.match(temp(20000), /Freezing/); });

test('scoring extremes', () => {
  assert.equal(finalScore(0, 1), 100);                       // perfect first try
  assert.ok(finalScore(HIT_KM, 1) >= 95);                    // a hit
  assert.equal(finalScore(0, 4), 55);                        // hit on the last try: −45 %
  assert.ok(finalScore(5000, 4) < 10);                       // wrong continent, all tries used
  assert.ok(finalScore(300, 2) > finalScore(300, 4));        // earlier is better
  assert.ok(finalScore(300, 1) > finalScore(3000, 1));       // closer is better
  assert.ok(finalScore(20000, 4) <= 1);                      // antipodal ≈ 0
});

test('pool: every puzzle for days 1..120 is valid', () => {
  const seen = new Set(); const names = new Set();
  for (const c of data.cities) {
    assert.ok(!names.has(c.name), 'duplicate city ' + c.name); names.add(c.name);
    for (const f of ['name', 'country', 'note']) assert.ok(typeof c[f] === 'string' && c[f].length >= (f === 'note' ? 15 : 2), `${c.name}.${f}`);
    assert.ok(Number.isFinite(c.lat) && Math.abs(c.lat) <= 90 && Number.isFinite(c.lng) && Math.abs(c.lng) <= 180, c.name + ' coords');
    assert.ok(c.ways.length >= 40, c.name + ' too sparse');
    const st = stats(c.ways);
    assert.ok(st.km > 8 && st.km < 60, `${c.name} km ${st.km}`);
    for (const w of decode(c.ways)) {
      assert.ok([0, 1, 2].includes(w.cls), c.name + ' class');
      assert.ok(w.pts.length >= 2, c.name + ' short way');
      for (const [x, y] of w.pts) assert.ok(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x <= 1000 && y >= 0 && y <= 1000, `${c.name} point ${x},${y}`);
    }
  }
  assert.ok(data.cities.length >= 60);
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const rng = makeRng(`figure-ground:${date}`);
    const p = game.puzzle({ data, day, date, slug: 'figure-ground', rng, pick: (a) => a[dailyIndex('figure-ground', day, a.length)] });
    assert.ok(p.city && data.cities.includes(p.city), 'day ' + day);
    seen.add(p.city.name);
  }
  assert.ok(seen.size >= 60, 'distinct cities over 120 days: ' + seen.size);
});

test('no leaks: the page text before the guess never names the city', () => {
  const m = game.meta;
  const text = JSON.stringify([m.tagline, m.howTo, m.scoring, m.dataNote]);
  for (const c of data.cities) assert.ok(!text.includes(c.name) && !text.includes(c.country + ', '), 'meta mentions ' + c.name);
  // the city's own note is only shown in the result card, and no way geometry contains text
  for (const c of data.cities) for (const w of c.ways) assert.ok(w.every((v) => typeof v === 'number'));
});
