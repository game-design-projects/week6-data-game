import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { decade, styleOptions, paletteStats, explain, YEAR_MIN, YEAR_MAX } from './game.js';
import { makeRng } from '../../engine/core.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const rng0 = { sample: (a, n) => a.slice(0, n), shuffle: (a) => a };
const hexRe = /^#[0-9a-f]{6}$/;

test('decade', () => assert.equal(decade(1889), '1880s'));
test('styleOptions: answer once, 4 distinct, far-period distractors', () => {
  const o = styleOptions(data.styles, 'Realism', 1880, rng0);
  assert.equal(o.length, 4); assert.equal(o.filter((x) => x.id === 'Realism').length, 1);
  for (const s of o.filter((x) => x.id !== 'Realism')) assert.ok(1880 < s.from - 10 || 1880 > s.to + 10, s.id);
});
test('paletteStats extremes', () => {
  const w = paletteStats(['#ffffff'], [1]); assert.equal(w.light, 1); assert.equal(w.sat, 0);
  const r = paletteStats(['#ff0000'], [1]); assert.ok(Math.abs(r.sat - 1) < 1e-9); assert.ok(Math.abs(r.light - 0.5) < 1e-9);
});
test('data sane', () => {
  assert.ok(data.paintings.length >= 60); assert.ok(JSON.stringify(data).length < 1.5e6);
  const ids = new Set();
  for (const p of data.paintings) {
    assert.ok(!ids.has(p.id)); ids.add(p.id);
    const s = data.styles.find((x) => x.id === p.style); assert.ok(s, p.style);
    assert.equal(p.colors.length, 5); assert.equal(p.share.length, 5);
    for (const c of p.colors) assert.match(c, hexRe);
    for (const v of p.share) assert.ok(v > 0 && v <= 1);
    assert.ok(Math.abs(p.share.reduce((a, b) => a + b) - 1) < 0.02);
    assert.ok(p.year >= YEAR_MIN && p.year <= YEAR_MAX && Number.isInteger(p.year));
    assert.ok(p.year >= s.from - 10 && p.year <= s.to + 10, `${p.id} year/style`);
    assert.ok(p.title && p.artist); assert.match(p.thumb, /^data:image\/jpeg;base64,/);
  }
});
test('styles have copy', () => { for (const s of data.styles) { assert.ok(s.name && s.note && s.from < s.to); } });
test('puzzle days 1-120 valid, no leaks in the visible part', () => {
  const { meta } = game;
  for (let day = 1; day <= 120; day++) {
    const rng = makeRng(`055-palette:${day}`);
    const pz = game.puzzle({ data, day, date: '', slug: 'palette', rng, pick: (a) => a[(day - 1) % a.length] });
    assert.equal(pz.options.length, 4);
    assert.equal(new Set(pz.options.map((o) => o.id)).size, 4);
    assert.equal(pz.options.filter((o) => o.id === pz.p.style).length, 1);
    for (const o of pz.options) assert.ok(o.name && o.id);
    // answer option is formatted exactly like the others (same keys)
    assert.deepEqual(Object.keys(pz.options[0]).sort(), Object.keys(pz.options[1]).sort());
    const ex = explain(pz.p, data.paintings, data.styles.find((s) => s.id === pz.p.style));
    assert.ok(ex.stats && !/NaN|undefined/.test(ex.stats));
  }
  assert.equal(meta.num, 55);
});
test('year scoring extremes (abs, scale 40)', () => {
  const sc = (e) => Math.round(100 * Math.exp(-e / 40));
  assert.equal(sc(0), 100); assert.ok(sc(30) > 40 && sc(30) < 55); assert.ok(sc(540) < 1);
});
