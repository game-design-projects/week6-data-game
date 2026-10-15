import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { spread, tier, explain } from './game.js';
import { makeRng, dailyIndex, isoFromDay } from '../../engine/core.js';
import { wpCodes, buildItem, TOP } from './build/build.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const rng = { shuffle: (a) => a };

test('spread keeps counts apart', () => {
  const items = [10, 11, 12, 30, 31, 60, 100, 101, 200].map((n, i) => ({ id: i, n }));
  const s = spread(items, 5, rng);
  assert.equal(s.length, 5);
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) assert.ok(Math.abs(s[i].n - s[j].n) >= 3);
});
test('tier buckets', () => {
  assert.match(tier(250), /全球/);
  assert.match(tier(5), /本地/);
});
test('wpCodes counts only Wikipedias', () => {
  const sl = { enwiki: 1, dewiki: 1, be_x_oldwiki: 1, commonswiki: 1, wikidatawiki: 1, enwikiquote: 1, specieswiki: 1, frwiktionary: 1 };
  assert.deepEqual(wpCodes(sl).sort(), ['be-x-old', 'de', 'en']);
});
test('buildItem shapes an entity', () => {
  const e = { labels: { en: { value: 'Foo' }, zh: { value: '福' } }, descriptions: { en: { value: 'a foo' } }, sitelinks: { enwiki: 1, zhwiki: 1, commonswiki: 1 } };
  const it = buildItem('Q1', e);
  assert.deepEqual(it, { id: 'Q1', name: 'Foo', zh: '福', desc: 'a foo', n: 2, top: 2, miss: TOP.filter((c) => c !== 'en' && c !== 'zh') });
  assert.equal(buildItem('Q2', { labels: {}, sitelinks: {} }), null);
});
test('explain is specific', () => {
  assert.match(explain({ name: 'X', n: 250, miss: [] }), /最大的 10 个维基百科全都有/);
  assert.match(explain({ name: 'X', n: 40, miss: ['ar', 'ja'] }), /阿拉伯语、日语/);
  assert.match(explain({ name: 'X', n: 20, miss: ['en', 'de', 'fr', 'es', 'ru', 'ja'] }), /很小的圈子/);
});

test('pool: days 1-120 all valid', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = isoFromDay(day);
    const p = game.puzzle({ data, day, date, slug: 'sitelinks', rng: makeRng(`sitelinks:${date}`), pick: (arr) => arr[dailyIndex('sitelinks', day, arr.length)] });
    assert.equal(p.items.length, 5, `day ${day} items`);
    assert.equal(new Set(p.items.map((i) => i.id)).size, 5, `day ${day} dup ids`);
    assert.equal(new Set(p.items.map((i) => i.n)).size, 5, `day ${day} tied counts`);
    for (const it of [...p.items, p.target]) {
      assert.ok(it.id && /^Q\d+$/.test(it.id), 'id');
      assert.ok(it.name && it.desc, `${it.id} text`);
      assert.ok(Number.isInteger(it.n) && it.n >= 12 && it.n <= 400, `${it.id} n`);
      assert.ok(Array.isArray(it.miss) && it.top === 10 - it.miss.length, `${it.id} top`);
      for (const s of [it.name, it.desc, it.zh]) assert.ok(!/undefined|NaN|null/.test(s ?? ''), `${it.id} bad text`);
      // no count in visible text before the guess
      assert.ok(!new RegExp(`\\b${it.n}\\b`).test(it.desc) || /atomic number|\d{4}/.test(it.desc), `${it.id} desc leaks count`);
    }
    const ns = p.items.map((i) => i.n).sort((a, b) => a - b);
    for (let i = 1; i < 5; i++) assert.ok(ns[i] - ns[i - 1] >= 3 && (ns[i] - ns[i - 1]) / ns[i] >= 0.07, `day ${day} counts too close`);
    assert.ok(!p.items.some((i) => i.id === p.target.id), 'target is in ranking');
    assert.notEqual(p.cat, p.tcat);
    seen.add(p.items.map((i) => i.id).join());
  }
  assert.ok(seen.size >= 100);
});

test('data quality', () => {
  assert.ok(data.cats.length >= 12);
  for (const c of data.cats) {
    assert.ok(c.items.length >= 40, c.key);
    assert.equal(new Set(c.items.map((i) => i.id)).size, c.items.length);
    for (const i of c.items) assert.ok(!/wikipedia|disambiguation/i.test(i.desc));
  }
});
