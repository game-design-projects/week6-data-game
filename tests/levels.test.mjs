// The shipped level file: enough days, every color reachable, clues that follow the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EPOCH, LEVELS, CLUE_MODEL } from '../web/levels.js';
import { PAINTS, POT_CAPACITY, MATCH, mixHex, accuracy, oklab, distance } from '../web/color.js';
import { OKLab_to_OKLCh } from '../web/vendor/spectral.js';
import { leaks } from '../scripts/hints.mjs';
import { survey, MIN_CHROMA } from '../scripts/colors.mjs';

test('at least a week of levels, starting on a real date', () => {
  assert.ok(LEVELS.length >= 7, `${LEVELS.length} levels`);
  assert.match(EPOCH, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(CLUE_MODEL);
});
test('every color is a vivid color straight from the xkcd survey', () => {
  const byHex = new Map(survey().map(c => [c.hex, c.name]));
  for (const l of LEVELS) {
    assert.equal(byHex.get(l.hex), l.name, `${l.hex} ${l.name}`);
    assert.ok(OKLab_to_OKLCh(oklab(l.hex))[1] >= MIN_CHROMA, `${l.name} is not vivid`);
  }
  assert.equal(new Set(LEVELS.map(l => l.hex)).size, LEVELS.length, 'no color repeats');
});
test('the par recipe really reaches a match within the pot', () => {
  for (const l of LEVELS) {
    const { counts, total } = l.par;
    assert.equal(counts.length, PAINTS.length);
    assert.equal(counts.reduce((a, b) => a + b, 0), total);
    assert.ok(total <= POT_CAPACITY);
    assert.ok(accuracy(mixHex(counts), l.hex) >= MATCH, `${l.name}: par recipe only reaches ${accuracy(mixHex(counts), l.hex)}`);
    assert.ok(Math.abs(accuracy(mixHex(l.best.counts), l.hex) - l.best.acc) < 0.11);
  }
});
test('three clues each, short, and never giving the answer away', () => {
  for (const l of LEVELS) {
    assert.equal(l.clues.length, 3, l.name);
    l.clues.forEach((clue, i) => {
      const leak = leaks(clue, l.name, i === 2); // only the last, plain clue may use color words
      assert.deepEqual(leak.name, [], `${l.name} clue ${i + 1} uses the name: ${clue}`);
      assert.deepEqual(leak.color, [], `${l.name} clue ${i + 1} uses a color word: ${clue}`);
      assert.ok(leak.words >= 2 && leak.words <= 18, `${l.name} clue ${i + 1} length: ${clue}`);
      assert.doesNotMatch(clue, /[#\d]/, `${l.name} clue ${i + 1} has a number`);
    });
  }
});
test('back-to-back days never share a hue family', () => {
  for (let i = 1; i < Math.min(LEVELS.length, 60); i++) {
    const h = l => Math.floor(OKLab_to_OKLCh(oklab(l.hex))[2] / 60);
    assert.notEqual(h(LEVELS[i]), h(LEVELS[i - 1]), `days ${i} and ${i + 1}`);
  }
});
test('no near-twin colors within any week', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    for (let j = i + 1; j < Math.min(LEVELS.length, i + 7); j++) {
      assert.ok(distance(LEVELS[i].hex, LEVELS[j].hex) >= 0.1, `days ${i + 1} (${LEVELS[i].name}) and ${j + 1} (${LEVELS[j].name})`);
    }
  }
});
