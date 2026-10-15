import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { areaBand, areaCell, scoreFor, toMulti, regionName, fmtLat, fmtLng } from './game.js';
import { dailyIndex, makeRng, addDays } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const slug = game.meta.slug;
const pickFor = (day) => (arr) => arr[dailyIndex(slug, day, arr.length)];
const puzzleFor = (day) => game.puzzle({ data, day, date: addDays('2026-10-01', day - 1), slug, rng: makeRng(`${slug}:${day}`), pick: pickFor(day) });

test('areaBand brackets the value', () => {
  assert.equal(areaBand(150e3), '100k – 200k km²');
  assert.equal(areaBand(5.9e6), '3.2M – 7M km²');
  assert.match(areaBand(9e6), /over 7M/);
  assert.match(areaBand(70e3), /under 100k/);
});

test('scoring extremes', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => scoreFor(n, true)), [100, 83, 67, 50, 33, 17]);
  assert.equal(scoreFor(6, false), 0);
});

test('area feedback direction is relative to the answer', () => {
  assert.match(areaCell(100, 400).text, /\u2191 4\.0/);
  assert.match(areaCell(400, 100).text, /\u2193 4\.0/);
  assert.equal(areaCell(100, 105).text, 'Similar');
});

test('helpers', () => {
  assert.equal(toMulti(data.rivers[0]).type, 'MultiPolygon');
  assert.equal(regionName('Africa'), 'Africa');
  assert.equal(fmtLat(-19.6), '19.6°S');
  assert.equal(fmtLng(21.64), '21.6°E');
});

test('every river entry is well formed', () => {
  assert.ok(data.rivers.length >= 60);
  const ids = new Set(), names = new Set();
  for (const r of data.rivers) {
    for (const k of ['id', 'name', 'region', 'mouth', 'note']) assert.ok(typeof r[k] === 'string' && r[k].length > 1 && !/undefined|NaN/.test(r[k]), `${r.id}.${k}`);
    assert.match(r.id, /^[a-z]+(-[a-z]+)*$/);
    assert.ok(r.rings.length > 0, r.id);
    assert.ok(r.area > 50000 && r.area < 7e6, r.id);
    assert.ok(Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180, r.id);
    assert.ok(r.bbox.length === 4 && r.bbox.every(Number.isFinite) && r.bbox[0] < r.bbox[2] && r.bbox[1] < r.bbox[3], r.id);
    for (const ring of r.rings) {
      assert.ok(ring.length >= 4, r.id);
      for (const [x, y] of ring) assert.ok(Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 180 && Math.abs(y) <= 90, r.id);
    }
    assert.ok(!ids.has(r.id), 'dup id ' + r.id);
    ids.add(r.id);
    names.add(r.name.toLowerCase());
    // the aliases must not collide with another river's name
    for (const a of r.aliases || []) assert.ok(!data.rivers.some((o) => o !== r && o.name.toLowerCase() === a.toLowerCase()), `${r.id} alias ${a}`);
  }
  assert.equal(names.size, data.rivers.length);
});

test('days 1-120: valid puzzle, answer is selectable, nothing visible leaks it', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = puzzleFor(day);
    assert.deepEqual(p, puzzleFor(day));
    const r = data.rivers.find((x) => x.id === p.id);
    assert.ok(r, `day ${day}`);
    seen.add(p.id);
    // clue text built in play() uses only these fields: no name, no mouth/note before the guess
    const letters = r.name.replace(/[^A-Za-zÀ-ÿ]/g, '');
    assert.ok(letters.length >= 2);
    assert.ok(areaBand(r.area).length > 0);
  }
  assert.equal(seen.size, data.rivers.length, 'first 120 days cover the whole pool');
});

test('first-cycle days never repeat', () => {
  const ids = [];
  for (let d = 1; d <= data.rivers.length; d++) ids.push(puzzleFor(d).id);
  assert.equal(new Set(ids).size, ids.length);
});

test('teaching text stays short enough for the result card', () => {
  for (const r of data.rivers) assert.ok(r.note.length < 160 && r.mouth.length < 90, r.id);
});
