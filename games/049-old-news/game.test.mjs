import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import game, { yearScore, findHints, eraNote } from './game.js';
import { mask, leaky, blocks } from './build/build.mjs';
import { makeRng } from '../../engine/core.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('yearScore extremes', () => {
  assert.equal(yearScore(1900, 1900), 100);
  assert.ok(Math.abs(yearScore(1910, 1900) - 36.8) < 0.1);
  assert.ok(yearScore(1890, 1900) < yearScore(1895, 1900));
  assert.ok(yearScore(1840, 1963) < 0.1); // worst case is near zero
  assert.ok(yearScore(1900, 1900 + 30) < 6); // blind mid-guess is punished
});
test('findHints', () => {
  assert.equal(findHints('The Telegraph and the Railroad').length, 2);
  assert.equal(findHints('nothing here').length, 0);
  assert.ok(findHints('to-day we went').length === 1);
});
test('eraNote covers every year', () => { for (let y = 1840; y <= 1963; y++) assert.ok(eraNote(y), String(y)); });
test('mask and leaky', () => {
  assert.equal(mask('in 1861 and 186l'), 'in ____ and ____');
  assert.ok(leaky('the ____-62 session'));
  assert.ok(leaky("of '62"));
  assert.ok(!leaky('the president spoke to the crowd'));
});
test('blocks joins hyphenated words via SUBS_CONTENT', () => {
  const xml = '<TextBlock><String CONTENT="inser" SUBS_TYPE="HypPart1" SUBS_CONTENT="insertion" WC="0.9"/><String CONTENT="tion" SUBS_TYPE="HypPart2" SUBS_CONTENT="insertion" WC="0.9"/><String CONTENT="now" WC="0.9"/></TextBlock>';
  assert.equal(blocks(xml)[0].text, 'insertion now');
});
test('pool validity over days 1-120', () => {
  const ids = new Set(data.items.map((x) => x.id));
  assert.equal(ids.size, data.items.length);
  assert.ok(data.items.length >= 60);
  for (const it of data.items) {
    assert.ok(Number.isInteger(it.year) && it.year >= 1840 && it.year <= 1963, it.id);
    assert.ok(it.date.startsWith(String(it.year)), it.id);
    assert.ok(it.paper && it.text.length >= 250 && it.text.length <= 560, it.id);
    assert.match(it.url, /^https:\/\/www\.loc\.gov\/item\/[\w-]+\/\d{4}-\d{2}-\d{2}\/ed-\d+\/$/, it.id);
    assert.ok(!/undefined|NaN|&#|\[object/.test(JSON.stringify(it)), it.id);
    // answer-leak scan: no 4-digit year, no leaky pattern, no masthead inside the snippet
    assert.ok(!leaky(it.text), `leak ${it.id}: ${it.text}`);
    assert.ok(!it.text.toLowerCase().includes(it.paper.toLowerCase()), it.id);
  }
  for (let day = 1; day <= 120; day++) {
    const p = game.puzzle({ data, day, date: '', slug: 'old-news', rng: makeRng(`049-${day}`), pick: (arr) => arr[(day * 7) % arr.length] });
    assert.equal(p.ids.length, 3, `day ${day}`);
    assert.equal(new Set(p.ids).size, 3);
    const ys = p.ids.map((id) => data.items.find((x) => x.id === id).year);
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) assert.ok(Math.abs(ys[a] - ys[b]) >= 12, `day ${day}`);
  }
});
