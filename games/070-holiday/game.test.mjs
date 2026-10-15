import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { redact, scoreFor, faithCounts, rarest } from './game.js';
import { makeRng, dailyIndex, isoFromDay } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const strip = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const words = (s) => s.match(/[\p{L}\p{M}]+/gu) ?? [];
const puzzleFor = (day) => {
  const date = isoFromDay(day);
  return game.puzzle({ data, day, date, slug: 'holiday', rng: makeRng(`holiday:${date}`), pick: (a) => a[dailyIndex('holiday', day, a.length)] });
};

test('data: every country is well-formed', () => {
  const ccs = new Set();
  for (const c of data.countries) {
    assert.match(c.cc, /^[A-Z]{2}$/);
    assert.ok(!ccs.has(c.cc), `duplicate ${c.cc}`); ccs.add(c.cc);
    assert.ok(c.name && c.capital.name && c.terms.length > 0, c.cc);
    assert.ok(Math.abs(c.capital.lat) <= 90 && Math.abs(c.capital.lng) <= 180, c.cc);
    assert.ok(c.holidays.length >= 5, c.cc);
    const days = new Set();
    for (const h of c.holidays) {
      assert.match(h.d, /^\d{2}-\d{2}$/);
      assert.ok(!Number.isNaN(Date.parse(`${data.year}-${h.d}T00:00:00Z`)), `${c.cc} ${h.d}`);
      assert.ok(!days.has(h.d), `${c.cc} duplicate date ${h.d}`); days.add(h.d);
      assert.ok(h.name.trim() && h.local.trim(), `${c.cc} ${h.d} empty name`);
      assert.ok(Number.isInteger(h.common) && h.common >= 1, `${c.cc} ${h.d} common`);
      assert.equal(typeof h.global, 'boolean');
      assert.ok(!/undefined|NaN|null/.test(h.name + h.local), `${c.cc} ${h.d}`);
    }
  }
});

test('pool: puzzles for days 1–120 are valid, selectable and not repeated within a cycle', () => {
  const options = new Set(data.countries.map((c) => c.cc));
  const playable = data.countries.filter((c) => c.play);
  assert.ok(playable.length >= 60);
  const seen = [];
  for (let day = 1; day <= 120; day++) {
    const p = puzzleFor(day);
    assert.deepEqual(p, puzzleFor(day), 'deterministic');
    assert.equal(p.year, data.year);
    assert.ok(options.has(p.cc), `answer ${p.cc} is a selectable option`);
    const c = data.countries.find((x) => x.cc === p.cc);
    assert.ok(c.play && c.holidays.length >= 6, p.cc);
    seen.push(p.cc);
  }
  assert.equal(new Set(seen).size, 120, 'no repeats in 120 days');
});

test('leaks: no redacted clue text names the country, its capital or their translations', () => {
  const generic = new Set(['republic', 'islands', 'island', 'united', 'states', 'south', 'north', 'saint', 'city', 'central', 'african', 'democratic']);
  for (const c of data.countries) {
    const own = [...words(c.name), ...words(c.capital.name)].map(strip).filter((w) => w.length >= 4 && !generic.has(w));
    for (const h of c.holidays) for (const raw of [h.name, h.local]) {
      const out = redact(raw, c.terms);
      assert.ok(!/[\p{L}]▇▇▇|▇▇▇[\p{L}]/u.test(out), `${c.cc}: fragment in "${out}"`);
      for (const w of words(out)) {
        const k = strip(w);
        assert.ok(!c.terms.some((t) => !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(t) && k.startsWith(t)), `${c.cc}: "${w}" survives in "${out}"`);
        assert.ok(!c.play || !own.includes(k), `${c.cc}: "${w}" survives in "${out}"`);
      }
    }
  }
});

test('redact: names, adjectives, local-language names, CJK, collapsing', () => {
  const dk = data.countries.find((c) => c.cc === 'DK');
  assert.equal(redact('Danmarks befrielsesdag', dk.terms), '▇▇▇ befrielsesdag');
  assert.equal(redact('Mexican Independence Day', data.countries.find((c) => c.cc === 'MX').terms), '▇▇▇ Independence Day');
  assert.equal(redact('Dan državnosti Srbije', data.countries.find((c) => c.cc === 'RS').terms), 'Dan državnosti ▇▇▇');
  assert.ok(!/Swiss|suisse/i.test(redact('Fête nationale suisse', data.countries.find((c) => c.cc === 'CH').terms)));
  assert.equal(redact('Hong Kong Special Administrative Region Establishment Day', data.countries.find((c) => c.cc === 'HK').terms).includes('Hong'), false);
  assert.equal(redact('\u65e5\u672c\u306e\u65e5', ['\u65e5\u672c']), '\u2587\u2587\u2587\u306e\u65e5');
  assert.equal(redact('Keep Everything', []), 'Keep Everything');
});

test('every playable puzzle has usable clues', () => {
  for (const c of data.countries.filter((x) => x.play)) {
    assert.equal(rarest(c.holidays, 3).length, 3, c.cc);
    const out = redact(rarest(c.holidays, 1)[0].name, c.terms);
    assert.ok(out.replace(/▇▇▇/g, '').trim().length > 0, `${c.cc}: rarest clue is fully blacked out`);
  }
  assert.deepEqual(faithCounts([{ name: 'Easter Sunday' }, { name: 'Eid al-Fitr' }, { name: 'Labour Day' }]).map((x) => x.label), ['Christian', 'Islamic']);
});

test('scoring: perfect, typical and worst', () => {
  assert.equal(scoreFor(1, true), 100);
  assert.equal(scoreFor(2, true), 83);
  assert.equal(scoreFor(3, true), 67);
  assert.equal(scoreFor(6, true), 17);
  assert.equal(scoreFor(6, false), 0);
  const s = [1, 2, 3, 4, 5, 6].map((n) => scoreFor(n, true));
  assert.deepEqual(s, [...s].sort((a, b) => b - a));
});

test('distinct puzzles across 14 days', () => {
  assert.ok(new Set(Array.from({ length: 14 }, (_, i) => puzzleFor(i + 1).cc)).size >= 7);
});
