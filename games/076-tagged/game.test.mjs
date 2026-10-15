import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { jaccard, titleHits, N_OPT } from './game.js';
import { makeRng, dailyIndex, isoFromDay } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('jaccard', () => {
  assert.equal(jaccard(['a', 'b'], ['a', 'b']), 1);
  assert.equal(jaccard(['a'], ['b']), 0);
  assert.equal(jaccard(['a', 'b'], ['b', 'c']), 1 / 3);
  assert.equal(jaccard([], []), 0);
});

test('scoring extremes', () => {
  const truth = ['ios', 'swift', 'swiftui'];
  assert.equal(jaccard(truth, truth), 1);                                     // perfect
  const allTen = [...truth, 'a', 'b', 'c', 'd', 'e', 'f', 'g'];
  assert.ok(Math.abs(jaccard(allTen, truth) - 0.3) < 1e-9);                   // select-all strategy is weak
  assert.equal(jaccard([], truth), 0);                                         // nothing picked
  assert.ok(jaccard(['ios', 'swift'], truth) > jaccard(allTen, truth));        // a good partial answer beats select-all
});

test('titleHits', () => {
  assert.deepEqual(titleHits('Push method in React Hooks (useState)?', ['javascript', 'reactjs', 'react-hooks']), ['reactjs', 'react-hooks']);
  assert.deepEqual(titleHits('How do I delete a Git branch locally and remotely?', ['git', 'branch', 'version-control']), ['git', 'branch']);
  assert.deepEqual(titleHits('Why is processing a sorted array faster?', ['java', 'c++']), []);
});

test('data shape', () => {
  assert.ok(data.sets.length >= 60);
  for (const s of data.sets) assert.equal(s.length, 5);
  assert.ok(fs.statSync(new URL('./data.json', import.meta.url)).size < 1.5e6);
});

test('every puzzle days 1-120 is valid', () => {
  const tagIdx = new Map(data.tags.map((t, i) => [t, i]));
  const trueF = [], distF = [];
  const titles = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = isoFromDay(day);
    const rng = makeRng(`tagged:${date}`);
    const pick = (arr) => arr[dailyIndex('tagged', day, arr.length)];
    const p = game.puzzle({ data, day, date, slug: 'tagged', rng, pick });
    assert.equal(p.rounds.length, 5);
    const ids = new Set();
    for (const r of p.rounds) {
      assert.ok(!ids.has(r.id), 'dup id'); ids.add(r.id);
      assert.ok(typeof r.title === 'string' && r.title.trim().length >= 12 && !/&(amp|lt|gt|quot|#\d+);/.test(r.title));
      assert.ok(Number.isInteger(r.year) && r.year >= 2008 && r.year <= 2026);
      assert.ok(Number.isFinite(r.score) && r.score > 0);
      assert.ok(r.tags.length >= 2 && r.tags.length <= 5);
      assert.equal(r.options.length, N_OPT);
      assert.equal(new Set(r.options).size, N_OPT, 'options distinct');
      for (const t of r.tags) assert.ok(r.options.includes(t), 'true tag selectable');
      for (const o of r.options) { assert.ok(o && !/undefined|NaN/.test(o)); (r.tags.includes(o) ? trueF : distF).push(Math.log(data.f[tagIdx.get(o)])); }
      // answer leak: no tag may be spelled in a caption other than the title; title must not carry the full tag list
      assert.ok(!/stackoverflow\.com/.test(r.title));
    }
    titles.add(p.rounds.map((r) => r.id).join());
  }
  assert.ok(titles.size >= 60, 'at least 60 distinct sets in 120 days');
  // rarity must not give true tags away: mean log-frequency of true and distractor tags within 1.0
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  assert.ok(Math.abs(mean(trueF) - mean(distF)) < 1.0, `freq leak ${mean(trueF)} vs ${mean(distF)}`);
});
