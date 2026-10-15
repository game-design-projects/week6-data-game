import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { bucket, redactTitle, scoreFor, isNamed, labelsFor } from './game.js';
import { makeRng, dailyIndex } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('bucket', () => { assert.equal(bucket(9.3), 4); assert.equal(bucket(8.2), 2); assert.equal(bucket(5), 0); });

test('redactTitle hides whole show words, never fragments', () => {
  assert.equal(redactTitle('Breaking Bad finale', { title: 'Breaking Bad' }), '▇▇▇ finale');
  assert.equal(redactTitle('Pilot', { title: 'Friends' }), 'Pilot');
  assert.equal(redactTitle('The Lost City of Atlantis', { title: 'Atlantis' }), 'The Lost City of ▇▇▇');
  assert.equal(redactTitle('Atlantis Rising', { title: 'Atlantis' }), '▇▇▇ Rising');
  assert.equal(redactTitle("Friends’ Night", { title: 'Friends' }), '▇▇▇’ Night'.replace('’', '’'));
  assert.equal(redactTitle('Another Friend', { title: 'Friends' }), 'Another Friend');
  assert.equal(redactTitle("The Office Olympics", { title: 'The Office' }), '▇▇▇ Olympics');
  assert.equal(redactTitle('Welcome to the Hellmouth', { title: 'Buffy the Vampire Slayer' }), 'Welcome to the Hellmouth');
  assert.equal(redactTitle('Slayer Vampire', { title: 'Buffy the Vampire Slayer' }), '▇▇▇ ▇▇▇');
});

test('scoring extremes', () => {
  assert.equal(scoreFor(1, true), 100);
  assert.equal(scoreFor(6, true), 17);
  assert.equal(scoreFor(6, false), 0);
  for (let n = 1; n < 6; n++) assert.ok(scoreFor(n, true) > scoreFor(n + 1, true));
});

test('labelsFor disambiguates duplicates', () => {
  assert.deepEqual(labelsFor([{ title: 'A', start: 1 }, { title: 'A', start: 2 }, { title: 'B', start: 3 }]), ['A (1)', 'A (2)', 'B']);
  assert.ok(isNamed('Pilot') && !isNamed('Episode #1.4') && !isNamed(''));
});

test('pool is valid and has no name leaks in clues', () => {
  assert.ok(data.shows.length >= 60);
  const ids = new Set();
  for (const s of data.shows) {
    assert.ok(/^tt\d+$/.test(s.id) && !ids.has(s.id)); ids.add(s.id);
    assert.ok(s.title && s.title.trim() === s.title);
    assert.ok(Number.isInteger(s.start) && s.start >= 1950 && s.start <= 2026, s.title);
    assert.ok(s.end === null || (Number.isInteger(s.end) && s.end >= s.start), s.title);
    assert.ok(s.genres.length >= 1 && s.genres.every((g) => g && g !== '\\N'));
    assert.ok(s.rating > 0 && s.rating <= 10 && s.votes >= 100000);
    assert.ok(s.eps.length >= 20);
    const seen = new Set();
    for (const [se, ep, r, t] of s.eps) {
      assert.ok(Number.isInteger(se) && se >= 1 && se <= 40 && Number.isInteger(ep) && ep >= 1 && ep <= 100, s.title);
      assert.ok(r >= 1 && r <= 10, s.title);
      assert.equal(typeof t, 'string');
      assert.ok(!seen.has(se + '-' + ep)); seen.add(se + '-' + ep);
      const red = redactTitle(t, s);
      for (const w of s.title.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !/^(the|with|and)$/i.test(w))) {
        assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`, 'iu').test(red), `${s.title}: ${red}`);
      }
    }
  }
});

test('puzzle() days 1-120 are valid', () => {
  const byId = new Map(data.shows.map((s) => [s.id, s]));
  const labels = labelsFor(data.shows);
  assert.equal(new Set(labels).size, labels.length);
  for (let day = 1; day <= 120; day++) {
    const rng = makeRng(`heatmap-${day}`);
    const p = game.puzzle({ data, day, date: '', slug: 'heatmap', rng, pick: (a) => a[dailyIndex('heatmap', day, a.length)] });
    assert.ok(byId.has(p.id), `day ${day}`);
    const s = byId.get(p.id);
    assert.ok(new Set(s.eps.map((e) => e[0])).size >= 2 && !Object.values(p).some((v) => v == null || v !== v));
  }
});
