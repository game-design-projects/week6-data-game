import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { fmtMb, vsHuman, scoreOf, explain, ANCHORS } from './game.js';
import { estimateSize, median } from './build/estimate.mjs';
import { dailyIndex } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const byName = Object.fromEntries(data.species.map((s) => [s.name, s]));
const pickFor = (day) => (arr) => arr[dailyIndex(game.meta.slug, day, arr.length)];

test('fmtMb units', () => {
  assert.equal(fmtMb(3000), '3 Gb');
  assert.equal(fmtMb(134), '134 Mb');
  assert.equal(fmtMb(0.0299), '29.9 kb');
});
test('vsHuman', () => {
  assert.match(vsHuman(15000, 3000), /5\.0×/);
  assert.match(vsHuman(3, 3000), /1\/1,000/);
});
test('estimateSize drops fragments and doubled assemblies', () => {
  assert.equal(median([1, 3, 2]), 2);
  const e = estimateSize([3000, 3100, 3050, 6100, 32, 2900]);
  assert.ok(e.mb > 2900 && e.mb < 3100, String(e.mb));
});
test('onion ~5x human; anchors present', () => {
  assert.ok(byName['Onion'].mb / byName['Human'].mb > 4 && byName['Onion'].mb / byName['Human'].mb < 6);
  for (const a of ANCHORS) assert.ok(byName[a], a);
  assert.ok(byName['Human'].mb > 2900 && byName['Human'].mb < 3200);
});
test('pool is large, sorted, well-formed', () => {
  const sp = data.species;
  assert.ok(sp.length >= 200);
  const seen = new Set();
  for (let i = 0; i < sp.length; i++) {
    const s = sp[i];
    assert.ok(s.sci && s.name && s.group, `fields ${i}`);
    assert.ok(Number.isFinite(s.mb) && s.mb >= 0.002 && s.mb <= 90000, `${s.name} ${s.mb}`);
    assert.ok(!seen.has(s.sci) && !seen.has(s.name), `dup ${s.name}`);
    seen.add(s.sci); seen.add(s.name);
    if (i) assert.ok(s.mb >= sp[i - 1].mb);
  }
});
test('scoring extremes', () => {
  assert.equal(scoreOf(100, 100), 1);
  assert.ok(Math.abs(scoreOf(200, 100) - 0.51) < 0.01);
  assert.ok(Math.abs(scoreOf(50, 100) - 0.51) < 0.01);
  assert.ok(scoreOf(1000, 100) < 0.12 && scoreOf(1000, 100) > 0.09);
  assert.ok(scoreOf(0.001, 100000) < 0.001);
});
test('puzzles days 1-120 valid, no leaks, no anchor items', () => {
  const sizes = [];
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: game.meta.slug, pick: pickFor(day) });
    assert.deepEqual(p, game.puzzle({ data, day, date: '2026-10-01', slug: game.meta.slug, pick: pickFor(day) }));
    assert.equal(p.items.length, 3);
    assert.equal(new Set(p.items.map((x) => x.sci)).size, 3);
    p.items.forEach((it, i) => {
      assert.ok(!ANCHORS.includes(it.name), `anchor as item day ${day}`);
      assert.ok(it.mb > 0 && Number.isFinite(it.mb));
      assert.ok(!/undefined|NaN/.test(JSON.stringify(it)));
      // shown before guessing: title, sci, group — the size must not appear in them
      const shown = `${it.name} ${it.sci} ${it.group}`;
      assert.ok(!/\d+(\.\d+)?\s?(Mb|Gb|kb)/i.test(shown), shown);
    });
    assert.ok(p.items[0].mb < p.items[2].mb);
    sizes.push(p.items.map((x) => x.sci).join('|'));
  }
  assert.ok(new Set(sizes).size >= 100, 'enough distinct days');
});
test('explain is species-specific', () => {
  const anchors = ANCHORS.map((z) => byName[z]);
  const t = explain(byName['Onion'], data.species, anchors);
  assert.match(t, /Onion/); assert.match(t, /Human/); assert.match(t, /4\.9×/);
  assert.notEqual(t, explain(byName['Maize'], data.species, anchors));
});
