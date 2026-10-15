import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { describeSpike, toPuzzle, rankSpikes, topMap, checkSeries, isBad, scoreFor, topUrl, seriesUrl } from './game.js';
import { dailyIndex } from '../../engine/core.js';
import data from './data.json' with { type: 'json' };
const fx = JSON.parse(fs.readFileSync(new URL('./build/fixture.json', import.meta.url), 'utf8'));

test('describeSpike', () => {
  const s = describeSpike([...Array(20).fill(100), 1000]);
  assert.equal(s.base, 100); assert.equal(s.factor, 10); assert.equal(s.calm, 20);
});

test('scoring extremes: perfect, typical, worst', () => {
  assert.equal(scoreFor(1, true), 100);
  assert.equal(scoreFor(3, true), 67);
  assert.equal(scoreFor(6, true), 17);
  assert.equal(scoreFor(6, false), 0);
  const s = [1, 2, 3, 4, 5, 6].map((n) => scoreFor(n, true));
  assert.deepEqual([...s].sort((a, b) => b - a), s); // strictly rewards fewer guesses
});

test('isBad filters special / list / adult pages', () => {
  for (const a of ['Main_Page', 'Special:Search', 'Deaths_in_2026', 'List_of_films', '2026', 'Pornhub', '-']) assert.ok(isBad(a), a);
  assert.ok(!isBad('Selma_Blair'));
});

test('url builders', () => {
  assert.equal(topUrl('2026-10-12'), 'https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/2026/10/12');
  assert.match(seriesUrl('AC/DC', '2026-10-12'), /user\/AC%2FDC\/daily\/2026092200\/2026101200$/);
});

test('toPuzzle shapes a live puzzle from the fixture', () => {
  const p = toPuzzle(fx.day, fx.tops, (a) => fx.series[a]);
  assert.ok(p, 'puzzle built');
  assert.equal(p.date, fx.day);
  assert.equal(p.series.length, 21);
  assert.equal(p.title, p.id.replaceAll('_', ' '));
  assert.ok(p.co.length >= 3 && p.co.length <= 5);
  assert.ok(p.co.every((c) => c.t !== p.title && c.r >= 2.2));
  const ranked = rankSpikes(fx.tops.slice(0, 3).map(topMap), topMap(fx.tops[3]));
  assert.ok(ranked.slice(0, 4).some((s) => s.a === p.id));
  assert.equal(game.puzzle({ data: { live: p, puzzles: data.puzzles }, pick: (a) => a[0] }), p);
});

test('toPuzzle rejects wrong-length / non-human series and moves on', () => {
  assert.equal(checkSeries(null, fx.day), null);
  assert.equal(checkSeries({ items: [] }, fx.day), null);
  const flat = { items: Array.from({ length: 21 }, (_, i) => ({ timestamp: fx.series[Object.keys(fx.series)[0]]?.items?.[i]?.timestamp ?? '', views: 1000 })) };
  assert.equal(checkSeries(flat, fx.day), null);
  assert.equal(toPuzzle(fx.day, fx.tops, () => null), null);
});

test('pool: every puzzle for days 1-120 is valid', () => {
  const opts = new Set(data.options);
  assert.ok(data.puzzles.length >= 60);
  assert.equal(opts.size, data.options.length, 'options unique');
  assert.ok(data.options.every((o) => typeof o === 'string' && o.trim() === o && o && !/undefined|NaN|_/.test(o)));
  const ids = new Set(), dates = new Set();
  for (const p of data.puzzles) { assert.ok(!ids.has(p.id + p.date)); ids.add(p.id + p.date); assert.ok(!dates.has(p.date), 'one puzzle per date'); dates.add(p.date); }
  const seen = new Set();
  const all = [...data.puzzles];
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, slug: 'spike', pick: (arr) => arr[dailyIndex('spike', day, arr.length)] });
    seen.add(p.id);
    all.push(p);
  }
  for (const p of all) {
    assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(opts.has(p.title), `answer selectable: ${p.title}`);
    assert.equal(p.series.length, 21);
    assert.ok(p.series.every((v) => Number.isInteger(v) && v >= 0), 'series ints');
    assert.ok(p.views >= 40000 && p.ratio >= 3 && p.ratio < 1e6, 'ranges');
    assert.ok(p.series.at(-1) >= 3 * Math.max(1, p.series.slice(0, 20).reduce((a, b) => a + b, 0) / 20), 'human spike visible in curve');
    assert.ok(p.co.length >= 3 && p.co.length <= 5);
    const ct = p.co.map((c) => c.t);
    assert.equal(new Set(ct).size, ct.length, 'co distinct');
    for (const c of p.co) {
      assert.ok(c.t && c.t !== p.title && opts.has(c.t), `co valid ${c.t}`);
      assert.ok(Number.isFinite(c.v) && c.v >= 40000 && Number.isFinite(c.r) && c.r >= 2.2);
    }
    // answer leak scan: nothing the player sees before guessing contains the title
    const pre = JSON.stringify([p.date, p.views]);
    assert.ok(!pre.toLowerCase().includes(p.title.toLowerCase()));
    assert.ok(!/^https?:/.test(p.title));
  }
  assert.ok(seen.size >= 80, 'most of the pool is reachable over 120 days');
});

test('meta copy matches behaviour', () => {
  assert.equal(game.meta.data, 'live');
  assert.ok(game.meta.sources.every((s) => /^https:\/\//.test(s.url)));
  assert.ok(game.meta.howTo.length >= 2);
});
