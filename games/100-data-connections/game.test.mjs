import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { groupScore, unambiguous, yearSpan, why, unitsOf, PROPS } from './game.js';
import { makeRng, dailyIndex, isoFromDay } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const TRAD = /[這們個與為說對時國會來傳點開關麼裡愛書電影學後從無發經過風龍師東華島區樂歲鐵羅馬頭寶號亞當標長門陸難飛應獨讀變體戰場黃紅隊雙譯覺齊魯約翰蘭爾亂]/;

const run = (day) => {
  const date = isoFromDay(day); const slug = game.meta.slug;
  return game.puzzle({ data, day, date, slug, rng: makeRng(`${slug}:${date}`), pick: (a) => a[dailyIndex(slug, day, a.length)] });
};

test('scoring extremes', () => {
  assert.equal(groupScore(4, 0), 100);
  assert.equal(groupScore(4, 3), 85);
  assert.equal(groupScore(3, 4), 55);
  assert.equal(groupScore(2, 3), 35);
  assert.equal(groupScore(0, 4), 0);
  assert.equal(groupScore(0, 9), 0);
  assert.ok(groupScore(4, 0) > groupScore(4, 2) && groupScore(4, 2) > groupScore(3, 0) - 1);
});

test('pool is large and data is small', () => {
  assert.ok(data.puzzles.length >= 60, `only ${data.puzzles.length} puzzles`);
  assert.ok(readFileSync(new URL('./data.json', import.meta.url)).length < 1.5e6);
});

test('days 1–120: every puzzle is valid, fair and leak-free', () => {
  const titles = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = run(day);
    assert.equal(p.groups.length, 4, `day ${day}`);
    assert.ok(unambiguous(p.groups), `day ${day}: duplicate labels`);
    const ids = new Set(); const qids = new Set();
    const names = p.groups.flatMap((g) => g.n.split(/[·\s]/).filter((x) => x.length >= 2));
    for (const g of p.groups) {
      assert.ok(g.label && g.n && g.qid && /^Q\d+$/.test(g.qid), `day ${day}: group fields`);
      assert.ok(PROPS[g.prop], `day ${day}: unknown prop ${g.prop}`);
      assert.ok(g.label.includes(g.n));
      assert.ok(!qids.has(g.qid), `day ${day}: duplicate group`); qids.add(g.qid);
      assert.equal(g.items.length, 4);
      for (const it of g.items) {
        assert.ok(typeof it.l === 'string' && it.l.trim() === it.l && it.l.length >= 2 && it.l.length <= 18, `day ${day}: label ${it.l}`);
        assert.ok(!/undefined|NaN|null/.test(it.l));
        assert.ok(/[一-鿿]/.test(it.l), `day ${day}: latin-only label ${it.l}`);
        assert.ok(!TRAD.test(it.l), `day ${day}: traditional label ${it.l}`);
        assert.match(it.q, /^Q\d+$/);
        assert.ok(!ids.has(it.q), `day ${day}: duplicate item id ${it.q}`); ids.add(it.q);
        if (it.y !== undefined) assert.ok(Number.isInteger(it.y) && it.y > 1300 && it.y <= 2026, `day ${day}: year ${it.y}`);
        // leak: no item may mention a group's subject name (before the guess nothing names a group)
        for (const n of names) assert.ok(!it.l.includes(n), `day ${day}: "${it.l}" mentions "${n}"`);
      }
    }
    const kinds = new Set(p.groups.map((g) => g.kind));
    assert.ok(kinds.size >= 2, `day ${day}: single-kind puzzle`);
    titles.add(p.groups.map((g) => g.qid).sort().join());
  }
  assert.ok(titles.size >= 60, `only ${titles.size} distinct puzzles in 120 days`);
});

test('border groups: land neighbours only, never the subject itself', () => {
  for (const pz of data.puzzles) for (const g of pz.groups) if (g.kind === 'border') {
    for (const it of g.items) assert.notEqual(it.l, g.n);
    assert.equal(g.unit, '国家');
  }
});

test('learnability text is specific', () => {
  const p = run(15);
  for (const g of p.groups) {
    const t = why(g, p.groups);
    assert.ok(t.includes(g.n) && t.includes(PROPS[g.prop].split(' ')[0]));
  }
  assert.equal(yearSpan([{ y: 1999 }, { y: 1963 }, {}]), '1963–1999');
  assert.equal(yearSpan([{}]), '');
  assert.ok(unitsOf(p.groups).length >= 2);
});
