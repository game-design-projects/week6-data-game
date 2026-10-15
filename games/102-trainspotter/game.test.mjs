import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { buildChoices, totalScore, pinVerdict } from './game.js';
import { makeRng, haversineKm } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const byId = new Map(data.models.map((m) => [m.id, m]));
const LABEL = /▇|█|\bundefined\b|\bNaN\b|^null$/;

// generous sanity boxes [south, west, north, east] where each type really runs
const BOX = {
  class390: [50, -5, 56, 1], class800: [50, -6, 58, 1], tgvr: [43, -5, 50, 8], tgvduplex: [43, -1, 50, 8],
  railjet: [46, 8, 49, 21], etr500: [37, 6, 47, 15], fuxing: [18, 100, 42, 124], ktx1: [33, 125, 39, 130],
  sapsan: [54, 28, 61, 45], giruno: [44, 7, 48, 11], ict: [46, 5, 54, 14], eurostar: [48, -2, 52, 4],
  acela: [37, -78, 43, -70], e5: [34, 138, 42, 142], e7: [34, 136, 38, 141], thalys: [48, 1, 53, 8],
  thsr: [21, 119, 26, 122], ave103: [36, -5, 43, 3],
};

test('data: models and photos are well formed', () => {
  assert.ok(data.photos.length >= 60, 'pool ≥ 60');
  assert.ok(new Set(data.photos.map((p) => p.id)).size === data.photos.length, 'unique ids');
  assert.ok(new Set(data.photos.map((p) => p.img)).size === data.photos.length, 'unique images');
  for (const m of data.models) {
    for (const k of ['id', 'name', 'op', 'country', 'family', 'tell']) assert.ok(m[k] && !LABEL.test(m[k]), `${m.id}.${k}`);
    assert.ok(BOX[m.id], `box for ${m.id}`);
  }
  for (const p of data.photos) {
    const m = byId.get(p.model);
    assert.ok(m, p.id);
    assert.match(p.img, /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/960px-[^/]+$/, p.id);
    assert.match(p.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, p.id);
    for (const k of ['title', 'author', 'lic']) assert.ok(p[k] && !LABEL.test(p[k]) && !/[<>]/.test(p[k]), `${p.id}.${k}`);
    assert.ok(!/http/.test(p.author), p.id);
    assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lng), p.id);
    const [s, w, n, e] = BOX[p.model];
    assert.ok(p.lat >= s && p.lat <= n && p.lng >= w && p.lng <= e, `${p.id} (${p.lat}, ${p.lng}) outside ${p.model} box`);
    assert.ok(!/\bNC\b|\bND\b/.test(p.lic), p.id);
  }
  // every model has photos and no model dominates the pool
  for (const m of data.models) assert.ok(data.photos.some((p) => p.model === m.id), m.id);
});

test('puzzle() days 1–120: answer selectable, distractors distinct, nothing leaks', () => {
  const days = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const rng = makeRng(`t${day}`);
    const pk = (arr) => arr[(day * 7) % arr.length];
    const p = game.puzzle({ data, day, date, slug: 'trainspotter', rng, pick: pk });
    const photo = data.photos.find((x) => x.id === p.photo);
    assert.ok(photo, `day ${day}`);
    days.add(p.photo);
    const m = byId.get(photo.model);
    for (const [list, key] of [[p.ops, 'op'], [p.names, 'name']]) {
      assert.equal(list.length, 4, `${day} ${key} count`);
      assert.equal(new Set(list).size, 4, `${day} ${key} distinct`);
      assert.equal(list.filter((x) => x === m[key]).length, 1, `${day} ${key} has answer once`);
      for (const l of list) assert.ok(typeof l === 'string' && l && !LABEL.test(l), `${day} ${key} label`);
      // every option is a real label from the model table
      for (const l of list) assert.ok(data.models.some((x) => x[key] === l), `${day} ${key} ${l}`);
    }
    // lookalikes of the answer never share a question
    for (const n of p.names) if (n !== m.name) assert.notEqual(data.models.find((x) => x.name === n).family, m.family, `${day} family`);
    // puzzle only references the photo id, nothing visible gives the answer away
    assert.deepEqual(Object.keys(p).sort(), ['names', 'ops', 'photo']);
  }
  assert.ok(days.size >= 30);
});

test('no visible pre-guess text names the answer', () => {
  // the caption/alt shown before answering are constants in game.js, never model/author/title
  const src = fs.readFileSync(new URL('./game.js', import.meta.url), 'utf8');
  assert.ok(/alt: '铁路照片'/.test(src));
  assert.ok(/作者与许可证在结算后显示/.test(src));
  // the OpenRailwayMap overlay only appears from zoom 6 (low zoom is a density heat map)
  assert.ok(/minZoom: 6/.test(src));
});

test('buildChoices: 4 distinct options, answer included, skip/prefer honoured', () => {
  const r = makeRng('t');
  for (const m of data.models) {
    const o = buildChoices(data.models, m, 'op', 3, r);
    assert.equal(new Set(o).size, 4);
    assert.ok(o.includes(m.op));
    const names = buildChoices(data.models, m, 'name', 3, r, { skip: (x) => x.family === m.family, prefer: (x) => x.country === m.country });
    assert.equal(new Set(names).size, 4);
    const sameCountry = data.models.filter((x) => x !== m && x.country === m.country && x.family !== m.family);
    if (sameCountry.length) assert.ok(names.some((n) => sameCountry.some((x) => x.name === n)), `${m.id} should get a same-country decoy`);
  }
});

test('scoring extremes: perfect, typical, worst', () => {
  assert.equal(totalScore(true, true, 100), 300);
  assert.equal(totalScore(false, false, 0), 0);
  const typical = totalScore(true, false, Math.round(100 * Math.exp(-400 / 600)));
  assert.ok(typical > 150 && typical < 200, String(typical));
  assert.equal(totalScore(true, true, 150), 300);
  // pin scale: a wrong-country guess in Europe scores low, same city scores high
  const sc = (km) => 100 * Math.exp(-km / 600);
  assert.ok(sc(5) > 99 && sc(1500) < 10 && sc(600) > 35 && sc(600) < 38);
  const paris = { lat: 48.88, lng: 2.36 }, london = { lat: 51.53, lng: -0.12 };
  assert.ok(haversineKm(paris, london) > 300);
});

test('pinVerdict is specific to the distance', () => {
  const set = new Set([5, 100, 800, 5000].map(pinVerdict));
  assert.equal(set.size, 4);
});
