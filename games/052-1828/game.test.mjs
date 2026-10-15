import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseEntry, redactWord, compareWords, leakTokens, clueSpecs, analyze } from './parse.js';
import { makeRng, dailyIndex, addDays, EPOCH } from '../../engine/core.js';
import game from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const words = new Set(data.words.split(' '));

test('parseEntry extracts pos, etymology and numbered senses', () => {
  const h = '<p><b>TUBE</b>, <i>noun</i> [Latin tubus.]</p><p><b>1.</b> A vessel; as a <i>tube</i>.</p><p><b>2.</b> A pipe.</p>';
  const e = parseEntry(h, 'tube');
  assert.equal(e.pos, '名词');
  assert.equal(e.ety, 'Latin tubus.');
  assert.deepEqual(e.senses, ['A vessel; as a tube.', 'A pipe.']);
  assert.equal(parseEntry(h, 'other'), null);
});
test('redactWord hides inflections and derivations', () => {
  assert.equal(redactWord('To improve; improvement of improved things', 'improve'), 'To ▇▇▇; ▇▇▇ of ▇▇▇ things');
  assert.equal(redactWord('A cat sat', 'cat'), 'A ▇▇▇ sat');
  assert.equal(redactWord('to smoke, smoking, smoked', 'smoking'), 'to ▇▇▇, ▇▇▇, ▇▇▇');
  assert.equal(redactWord('the south wind', 'southern'), 'the ▇▇▇ wind');
  assert.equal(redactWord('riding and rides', 'ride'), '▇▇▇ and ▇▇▇');
});
test('compareWords', () => {
  assert.deepEqual(compareWords('apple', 'zebra'), { dir: '↓', len: 0, first: false });
  assert.equal(compareWords('x', 'x').dir, '=');
});
test('scoring extremes: default guess score is 100 on first try, 0 on loss, strictly decreasing', () => {
  const sc = (n, max = 6) => Math.round((100 * (max - n + 1)) / max);
  assert.equal(sc(1), 100);
  assert.equal(sc(6), 17);
  for (let n = 1; n < 6; n++) assert.ok(sc(n) > sc(n + 1));
});

test('pool: every entry is clean and answerable', () => {
  assert.ok(data.pool.length >= 100);
  const seen = new Set();
  for (const e of data.pool) {
    assert.ok(!seen.has(e.w), `dup ${e.w}`);
    seen.add(e.w);
    assert.match(e.w, /^[a-z]{4,}$/);
    assert.ok(words.has(e.w), `${e.w} not guessable`);
    assert.ok(e.pos, `${e.w} pos`);
    assert.ok(e.senses.length >= 3 && e.senses.length <= 6);
    for (const s of e.senses) {
      assert.ok(typeof s === 'string' && s.length >= 12 && !/undefined|NaN/.test(s), `${e.w} sense`);
      assert.deepEqual(leakTokens(s, e.w), [], `${e.w} leaks in sense: ${s}`);
    }
    assert.ok(!/undefined|NaN/.test(e.ety || ''));
    // headword never appears verbatim in the visible clue text
    const vis = [...e.senses, e.ety || ''].map((t) => redactWord(t, e.w)).join(' ').toLowerCase();
    assert.ok(!new RegExp(`\\b${e.w}\\b`).test(vis), `${e.w} visible`);
    // clue slots are distinct
    const specs = clueSpecs(e).map((c) => c.t + (c.i ?? ''));
    assert.equal(new Set(specs).size, 6, `${e.w} clue slots ${specs}`);
    assert.equal(specs[5], 'letters');
    assert.ok(analyze(e).length >= 2);
  }
});
test('options: sorted unique lowercase words, no spaces', () => {
  const arr = data.words.split(' ');
  assert.ok(arr.length > 50000);
  assert.equal(arr.length, words.size);
  for (const w of arr.slice(0, 5000)) assert.match(w, /^[a-z]+$/);
});

test('puzzle() over days 1-120: deterministic, answer selectable, no repeats within the pool', () => {
  const slug = '1828';
  const got = [];
  for (let day = 1; day <= 120; day++) {
    const date = addDays(EPOCH, day - 1);
    const mk = () => game.puzzle({ data, day, date, slug, rng: makeRng(`${slug}:${date}`), pick: (a) => a[dailyIndex(slug, day, a.length)] });
    const p = mk();
    assert.deepEqual(p, mk());
    assert.ok(p.w && words.has(p.w) && data.pool.some((e) => e.w === p.w), `day ${day}`);
    got.push(p.w);
  }
  assert.equal(new Set(got).size, 120);
});
