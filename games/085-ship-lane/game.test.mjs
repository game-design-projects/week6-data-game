import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { distKm, bearing, arrow, axisWords } from './geo.js';
import game, { scoreFor, explain, coordClue } from './game.js';

const dir = fileURLToPath(new URL('.', import.meta.url));
const data = JSON.parse(readFileSync(dir + 'data.json', 'utf8'));
const pickFor = (day) => (arr) => arr[(day * 7919 + 13) % arr.length]; // deterministic stand-in for the engine picker

test('distance', () => {
  assert.ok(Math.abs(distKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.2) < 1);
  assert.equal(distKm({ lat: 5, lng: 5 }, { lat: 5, lng: 5 }), 0);
});
test('bearing', () => {
  assert.equal(arrow(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })), '↑');
  assert.equal(arrow(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })), '→');
  assert.equal(arrow(bearing({ lat: 0, lng: 0 }, { lat: -1, lng: -1 })), '↙');
});
test('axis words', () => {
  assert.equal(axisWords(0), '南北走向');
  assert.equal(axisWords(179), '南北走向');
  assert.equal(axisWords(90), '东西走向');
  assert.equal(axisWords(45), '东北—西南走向');
  assert.equal(axisWords(135), '西北—东南走向');
});

test('scoring extremes', () => {
  assert.equal(scoreFor(1, true), 100);
  assert.equal(scoreFor(6, true), 17);
  assert.equal(scoreFor(6, false), 0);
  const s = [1, 2, 3, 4, 5, 6].map((n) => scoreFor(n, true));
  for (let i = 1; i < s.length; i++) assert.ok(s[i] < s[i - 1], 'strictly decreasing');
  assert.ok(s[5] > 0);
});

test('pool: 60+ places, sane fields', () => {
  assert.ok(data.places.length >= 60);
  const ids = new Set(), zh = new Set(), en = new Set();
  for (const p of data.places) {
    for (const k of ['id', 'zh', 'en', 'kind', 'note']) assert.ok(typeof p[k] === 'string' && p[k].trim() && !/undefined|NaN/.test(p[k]), `${p.id}.${k}`);
    assert.ok(!ids.has(p.id) && !zh.has(p.zh) && !en.has(p.en), 'duplicate ' + p.id);
    ids.add(p.id); zh.add(p.zh); en.add(p.en);
    assert.ok(['strait', 'port'].includes(p.kind));
    assert.ok(p.lat > 30 && p.lat < 70 && p.lng > -15 && p.lng < 35, p.id + ' coords');
    assert.equal(p.files.length, 3); assert.equal(p.half.length, 3); assert.equal(p.spanKm.length, 3);
    p.files.forEach((f) => { assert.match(f, /^c\d+-[012]\.png$/); assert.ok(existsSync(dir + 'img/' + f), f); });
    p.half.forEach((h, i) => { assert.ok(h > 10000 && h < 2e6); if (i) assert.ok(h > p.half[i - 1]); });
    p.cover.forEach((c) => assert.ok(c >= 0.08 && c <= 1, p.id + ' coverage'));
  }
  const files = data.places.flatMap((p) => p.files);
  assert.equal(new Set(files).size, files.length);
});

test('puzzles for days 1-120 are valid', () => {
  for (let day = 1; day <= 120; day++) {
    const pz = game.puzzle({ data, day, date: '2026-10-01', slug: 'ship-lane', pick: pickFor(day) });
    assert.ok(pz.place && data.places.some((p) => p.id === pz.place.id), 'answer is a selectable option');
    assert.ok(JSON.stringify(pz).length > 50);
    const lines = explain(pz.place);
    assert.ok(lines.length >= 2 && lines.every((l) => l && !/undefined|NaN/.test(l)));
  }
});

test('no answer leaks: nothing visible names the place', () => {
  // visible clue strings (type, coarse coords, captions, alt) are generic; file names are opaque
  for (const p of data.places) {
    for (const f of p.files) assert.ok(!f.toLowerCase().includes(p.id), 'file name leaks ' + p.id);
    assert.ok(p.spanKm.every((k) => k > 0));
  }
  const src = readFileSync(dir + 'game.js', 'utf8');
  assert.ok(!/alt:\s*place/.test(src) && src.includes("地名已隐藏"));
});

test('coordinate clue is a coarse 5-degree box', () => {
  const n = {};
  data.places.forEach((p) => { const k = coordClue(p); n[k] = (n[k] || 0) + 1; });
  assert.ok(Object.values(n).filter((c) => c === 1).length / data.places.length < 0.5, 'too many places identified by the box alone');
  assert.equal(coordClue({ lat: 51, lng: 1.5 }), '大致位置：50°–55°N，0°E–5°E');
  assert.equal(coordClue({ lat: 36, lng: -5.6 }), '大致位置：35°–40°N，10°W–5°W');
});
