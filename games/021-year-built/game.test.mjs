import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { yearScore, thumb, eraClue, floorClue, classLabel, TIERS, tierOf, MIN_YEAR, MAX_YEAR } from './game.js';
import { makeRng, dailyIndex, isoFromDay } from '../../engine/core.js';
import { matchPluto } from './build/build.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const slug = 'year-built';
const run = (day) => {
  const date = isoFromDay(day);
  return game.puzzle({ data, day, date, slug, rng: makeRng(`${slug}:${date}`), pick: (arr) => arr[dailyIndex(slug, day, arr.length)] });
};

test('yearScore extremes', () => {
  assert.equal(yearScore(1900, 1900), 1);
  assert.ok(Math.abs(yearScore(1930, 1900) - Math.exp(-1)) < 1e-9);
  assert.ok(yearScore(1800, 1900) < yearScore(1890, 1900));
  assert.ok(yearScore(MIN_YEAR, MAX_YEAR) < 0.001);
  assert.ok(Math.abs(100 * yearScore(1920, 1900) - 51.3) < 0.5);
  const avg = (f) => data.items.reduce((s, b) => s + yearScore(f(b), b.year), 0) / data.items.length;
  const blind = avg(() => 1900);
  const skilled = avg((b) => b.year + (b.year % 2 ? 15 : -15));
  assert.ok(blind < 0.45 && skilled > 0.55, `blind ${blind} skilled ${skilled}`);
});

test('pool: size, era tiers and sane fields', () => {
  assert.ok(data.items.length >= 60);
  for (const t of TIERS) assert.ok(tierOf(data.items, t).length >= 20, `tier ${t}`);
  const ids = new Set(); const files = new Set();
  for (const b of data.items) {
    assert.ok(/^Q\d+$/.test(b.id)); assert.ok(!ids.has(b.id), 'dup id ' + b.id); ids.add(b.id);
    assert.ok(!files.has(b.file), 'dup file'); files.add(b.file);
    for (const k of ['name', 'boro', 'file', 'author', 'lic', 'cls']) assert.ok(typeof b[k] === 'string' && b[k].trim() && !/undefined|NaN|null/.test(b[k]), `${b.id}.${k}=${b[k]}`);
    assert.ok(Number.isInteger(b.year) && b.year >= MIN_YEAR && b.year <= MAX_YEAR, b.id);
    assert.ok(Math.abs(b.py - b.year) <= 3, `${b.id} PLUTO year disagrees`);
    assert.ok(Number.isInteger(b.fl) && b.fl >= 0 && b.fl < 120);
    assert.match(b.file, /\.jpe?g$/i);
    assert.doesNotThrow(() => new URL(thumb(b.file)));
    assert.ok(thumb(b.file).startsWith('https://commons.wikimedia.org/wiki/Special:FilePath/'));
  }
});

test('puzzles for days 1-120 are valid', () => {
  const sig = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = run(day);
    assert.equal(p.items.length, 3);
    assert.equal(new Set(p.items.map((b) => b.id)).size, 3, 'day ' + day);
    for (const t of TIERS) assert.equal(p.items.filter((b) => b.year >= t[0] && b.year < t[1]).length, 1);
    assert.deepEqual(p, JSON.parse(JSON.stringify(p)));
    assert.deepEqual(run(day), p, 'deterministic');
    sig.add(p.items.map((b) => b.id).join());
  }
  assert.ok(sig.size >= 100, 'varied puzzles ' + sig.size);
});

test('nothing visible before the guess carries the answer', () => {
  const src = fs.readFileSync(new URL('./game.js', import.meta.url), 'utf8');
  assert.ok(src.includes("alt: 'Photo of a New York City building'"));
  for (const b of data.items) assert.ok(['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island'].includes(b.boro), b.id);
  assert.ok(!/ctx\.log\('round', i \+ 1, b\.(name|year)/.test(src));
});

test('learnable clues exist for every era and floor count', () => {
  for (const y of [1750, 1850, 1900, 1930, 1960, 1990, 2015]) assert.ok(eraClue(y).length > 20);
  assert.equal(floorClue({ fl: 0 }), '');
  assert.match(floorClue({ fl: 40 }), /40-story/);
  assert.equal(classLabel('D4'), 'Elevator apartments');
  assert.equal(classLabel(''), 'Building');
});

test('matchPluto keeps only lots whose year agrees with Wikidata', () => {
  const b = { lat: 40.77, lng: -73.95, year: 1958 };
  const lots = [
    { latitude: '40.7701', longitude: '-73.9501', yearbuilt: '1910', address: 'A' },
    { latitude: '40.7702', longitude: '-73.9502', yearbuilt: '1960', address: 'B' },
  ];
  assert.equal(matchPluto(b, lots).address, 'B');
  assert.equal(matchPluto({ ...b, year: 1800 }, lots), null);
  assert.equal(matchPluto(b, undefined), null);
});
