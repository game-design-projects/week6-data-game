import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { visibleText } from './game.js';
import { makeRng, dailyIndex, haversineKm, expScore, isoFromDay } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const byId = new Map(data.puzzles.map((p) => [p.id, p]));
const slug = game.meta.slug;
const puzzleFor = (day) => game.puzzle({ data, day, date: isoFromDay(day), slug, rng: makeRng(`${slug}:${day}`), pick: (arr) => arr[dailyIndex(slug, day, arr.length)] });

test('pool is big enough and ids are unique', () => {
  assert.ok(data.puzzles.length >= 60, `only ${data.puzzles.length}`);
  assert.equal(byId.size, data.puzzles.length);
  assert.ok(new Set(data.puzzles.map((p) => p.city)).size >= 40);
});

test('days 1-120: every puzzle resolves to a well-formed entry', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const out = puzzleFor(day);
    assert.deepEqual(Object.keys(out), ['id']);
    const p = byId.get(out.id);
    assert.ok(p, `day ${day}: unknown id ${out.id}`);
    seen.add(p.id);
    for (const k of ['city', 'cityZh', 'country', 'desc', 'why', 'img', 'page', 'title', 'artist', 'lic']) {
      assert.equal(typeof p[k], 'string', `${p.id}.${k}`);
      assert.ok(p[k].trim().length > 0 && !/undefined|NaN|null/.test(p[k]), `${p.id}.${k} = ${p[k]}`);
    }
    assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 85 && Math.abs(p.lng) <= 180, `coords ${p.id}`);
    assert.ok(p.desc.length >= 30 && p.desc.length <= 420, `desc length ${p.id}`);
    assert.ok(p.why.length >= 40, `why length ${p.id}`);
    assert.ok(p.signs === null || (typeof p.signs === 'string' && p.signs.length > 3), `signs ${p.id}`);
    assert.match(p.img, /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/[^/]+\/500px-[^/]+$/, `img ${p.id}`);
    assert.match(p.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:\S+$/, `page ${p.id}`);
  }
  assert.ok(seen.size >= 55, `only ${seen.size} distinct puzzles in 120 days`);
});

test('the first two weeks never repeat a puzzle', () => {
  const ids = Array.from({ length: 14 }, (_, i) => puzzleFor(i + 1).id);
  assert.equal(new Set(ids).size, 14);
});

// ---- answer leaks --------------------------------------------------------------------------
const COUNTRY_SHORT = (c) => c.replace(/^中国(?=香港)/, '');
const NAMES = [...new Set(data.puzzles.flatMap((p) => [p.city, p.cityZh, COUNTRY_SHORT(p.country)]))];
const EXTRA = ['Fulton', 'Bronx', 'Dhaka', '布朗克斯', 'Edinburgh', 'Prague', 'Praha', 'Nahalat', 'Moskva', 'Москва', '苏格兰', '英格兰', '夏威夷', '加州'];

test('nothing visible before the guess names the answer', () => {
  for (const p of data.puzzles) {
    const text = visibleText(p).toLowerCase();
    for (const n of [...NAMES, ...EXTRA]) assert.ok(!text.includes(n.toLowerCase()), `puzzle ${p.id} (${p.city}) leaks "${n}"`);
    assert.ok(!/▇|█|■/.test(text), `redaction fragment in ${p.id}`);
  }
});

test('the page title and map do not carry the answer (labels only on reveal)', () => {
  assert.ok(!/(city|country|place)/i.test(game.meta.title));
  // guessing happens on the engine pin preset's label-free basemap; labels are switched on by the preset after the guess
  const src = fs.readFileSync(new URL('./game.js', import.meta.url), 'utf8');
  assert.ok(!/basemap:\s*'(imagery|topo)'/.test(src));
  assert.ok(!/labels:\s*true/.test(src));
});

test('why differs per puzzle and names a concrete clue', () => {
  assert.equal(new Set(data.puzzles.map((p) => p.why)).size, data.puzzles.length);
  for (const p of data.puzzles) assert.ok(/关键线索|描述(很)?泛|描述偏泛|描述很泛/.test(p.why), `why should flag the clue or admit it is vague: ${p.id}`);
});

test('coordinates are near the named city (Commons geotag within 12 km)', () => {
  const src = fs.readFileSync(new URL('./build/fetch.mjs', import.meta.url), 'utf8') + fs.readFileSync(new URL('./build/098-fetch2.mjs', import.meta.url), 'utf8');
  const centers = {};
  for (const m of src.matchAll(/\['([^']+)',\s*(-?[\d.]+),\s*(-?[\d.]+)\]/g)) centers[m[1]] = { lat: +m[2], lng: +m[3] };
  for (const p of data.puzzles) {
    const c = centers[p.city];
    assert.ok(c, `no city centre for ${p.city}`);
    assert.ok(haversineKm(c, p) < 12, `${p.id} ${p.city} is ${haversineKm(c, p).toFixed(1)} km from centre`);
  }
});

// ---- scoring extremes (engine pin preset: expScore(km, scale 2000)) --------------------------
test('scoring rewards accuracy: perfect, typical and worst guesses', () => {
  const s = (km) => Math.round(expScore(km, 2000, 100));
  assert.equal(s(0), 100);
  assert.ok(s(100) >= 94);
  assert.equal(s(2000), 37);
  assert.ok(s(5000) < 10 && s(5000) > 0);
  assert.ok(s(20000) <= 1);
  // a guess at the right continent (≈ 3000 km) clearly beats a guess on the wrong one (≈ 9000 km)
  assert.ok(s(3000) >= 20 && s(9000) <= 2);
});

test('the pool is spread across the world (no continent hogs more than 45%)', () => {
  const box = (p) => (p.lng < -30 ? 'americas' : p.lng < 60 ? (p.lat > 35 ? 'europe' : 'africa/mideast') : 'asia/oceania');
  const n = {};
  for (const p of data.puzzles) n[box(p)] = (n[box(p)] ?? 0) + 1;
  for (const [k, v] of Object.entries(n)) assert.ok(v / data.puzzles.length <= 0.45, `${k}: ${v}`);
  assert.ok(Object.keys(n).length === 4);
});
